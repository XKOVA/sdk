// eslint-disable-next-line no-restricted-imports
import {
  APIClient,
  IeeService,
  type IeeReceiptProviderParams,
  type IeeReceiptProvider,
  type IeeReceiptProviderResult,
} from "@xkova/sdk-core";
import { getTrustedIeeMessageData } from "./message-validation.js";

export interface LaunchIeeParams {
  /** Full URL to the oauth-server IEE (SafeApprove) surface (GET /iee). */
  ieeUrl: string;
  /** Exact origin expected from postMessage events (e.g., https://auth.example.com). */
  expectedIeeOrigin: string;
  /** Correlation id used to bind messages to a specific pending intent. */
  receiptRequestId: string;
  /** Prep ticket id issued by oauth-server. */
  ticketId: string;
  /** Optional draft/intent id for display correlation. */
  draftId?: string;
  /** Optional timeout in milliseconds (defaults to 60s). */
  timeoutMs?: number;
  /** Abort signal to cancel launch. */
  signal?: AbortSignal;
  /**
   * Origin that should receive the receipt (defaults to window.location.origin).
   * This must match an allowlisted origin configured for the OAuth client.
   */
  returnOrigin?: string;
}

export type LaunchIeeResult =
  | {
      status: 'approved';
      receipt: string;
      actionType?: string;
      actionHash?: string;
      jti?: string;
      receiptExpiresAt?: number;
      contextHash?: string | null;
      txIntent?: any;
      userOpHash?: string | null;
      /** Transaction hash returned by the IEE (SafeApprove) submission flow (when available). */
      transactionHash?: string | null;
      /** Optional preparation token returned by IEE (SafeApprove) signing flows. */
      preparationToken?: string | null;
      /** Optional installation id returned by agent install flows. */
      installationId?: string | null;
      /** Optional canonical payload returned by the IEE (SafeApprove) flow. */
      resolvedPayload?: Record<string, unknown> | null;
    }
  | { status: 'cancelled' }
  | { status: 'error'; error: { code: string; message: string } };

interface ChildHandle {
  ref: Window | null;
  cleanup: () => void;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_READY_TIMEOUT_MS = 4_000;
const MAX_READY_TIMEOUT_MS = 15_000;

function normalizeOrigin(value: string, base?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value, base);
    return url.origin.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export interface BrowserIeeReceiptProviderOptions {
  /** Full URL to the oauth-server IEE (SafeApprove) surface (GET /iee). */
  ieeUrl: string;
  /**
   * Expected origin for postMessage validation.
   * Defaults to the origin derived from `ieeUrl` when omitted.
   */
  expectedIeeOrigin?: string;
  /**
   * OAuth API client for issuing prep tickets.
   * Provide this or `authBaseUrl` + `getAccessToken`.
   */
  authApi?: APIClient;
  /**
   * OAuth base URL used to construct an APIClient when `authApi` is omitted.
   */
  authBaseUrl?: string;
  /**
   * Access token provider used with `authBaseUrl`.
   */
  getAccessToken?: () => Promise<string | null>;
  /** Optional draft/intent id for display correlation. */
  draftId?: string;
  /** Optional timeout in milliseconds (defaults to 60s). */
  timeoutMs?: number;
  /**
   * Origin that should receive the receipt (defaults to window.location.origin).
   * This must match an allowlisted origin configured for the OAuth client.
   */
  returnOrigin?: string;
}

const resolveExpectedOrigin = (ieeUrl: string, expected?: string): string => {
  if (expected) {
    return normalizeOrigin(expected);
  }
  return normalizeOrigin(ieeUrl);
};

const resolveIeeService = (options: BrowserIeeReceiptProviderOptions): IeeService => {
  if (options.authApi) {
    return new IeeService({ client: options.authApi });
  }
  const authBaseUrl = String(options.authBaseUrl ?? "").trim();
  if (!authBaseUrl) {
    throw new Error("authApi or authBaseUrl is required to create a SafeApprove receipt provider.");
  }
  if (!options.getAccessToken) {
    throw new Error("getAccessToken is required when authBaseUrl is provided.");
  }
  const authApi = new APIClient({
    baseUrl: authBaseUrl,
    getAccessToken: options.getAccessToken,
  });
  return new IeeService({ client: authApi });
};

const normalizeLaunchResult = (result: LaunchIeeResult): IeeReceiptProviderResult => {
  if (result.status === "approved") {
    return {
      status: "approved",
      receipt: result.receipt,
      actionType: result.actionType,
      actionHash: result.actionHash,
      jti: result.jti,
      contextHash: result.contextHash ?? null,
      transactionHash: result.transactionHash ?? null,
      userOpHash: result.userOpHash ?? null,
      preparationToken: result.preparationToken ?? null,
      installationId: result.installationId ?? null,
      resolvedPayload: result.resolvedPayload ?? null,
    };
  }
  if (result.status === "cancelled") {
    return { status: "cancelled" };
  }
  return {
    status: "error",
    error: {
      code: result.error?.code ?? "IEE_ERROR",
      message: result.error?.message ?? "SafeApprove returned an error.",
    },
  };
};

function buildIeeUrl(params: LaunchIeeParams, returnOrigin: string): URL {
  const url = new URL(params.ieeUrl, typeof window !== 'undefined' ? window.location.href : undefined);
  url.searchParams.set('receipt_request_id', params.receiptRequestId);
  url.searchParams.set('return_origin', returnOrigin);
  url.searchParams.set('ticket_id', params.ticketId);
  if (params.draftId) {
    url.searchParams.set('draft_id', params.draftId);
  }
  url.searchParams.set('mode', 'iframe');
  return url;
}

function overridePointerEvents(): () => void {
  const body = document.body;
  const html = document.documentElement;
  const prevBodyPointerEvents = body.style.pointerEvents;
  const prevHtmlPointerEvents = html.style.pointerEvents;

  body.style.pointerEvents = 'auto';
  html.style.pointerEvents = 'auto';

  return () => {
    body.style.pointerEvents = prevBodyPointerEvents;
    html.style.pointerEvents = prevHtmlPointerEvents;
  };
}

function openIframe(url: URL): ChildHandle {
  const container = document.createElement('div');
  container.setAttribute('data-xkova-iee-overlay', 'true');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.background = 'rgba(0,0,0,0.55)';
  container.style.backdropFilter = 'blur(3px)';
  container.style.zIndex = '2147483647';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.padding = '16px';
  container.style.boxSizing = 'border-box';
  container.style.pointerEvents = 'auto';
  container.setAttribute('aria-label', 'SafeApprove approval overlay');

  const frameShell = document.createElement('div');
  frameShell.style.width = 'min(980px, 100%)';
  frameShell.style.height = 'min(860px, calc(100vh - 32px))';
  frameShell.style.maxWidth = '100%';
  frameShell.style.maxHeight = '100%';
  frameShell.style.border = '1px solid rgba(255,255,255,0.16)';
  frameShell.style.borderRadius = '16px';
  frameShell.style.overflow = 'hidden';
  frameShell.style.background = 'rgba(10,10,14,0.9)';
  frameShell.style.boxShadow = '0 24px 80px rgba(0,0,0,0.45)';
  frameShell.style.pointerEvents = 'auto';

  const frame = document.createElement('iframe');
  frame.src = url.toString();
  frame.title = 'XKOVA SafeApprove';
  frame.style.display = 'block';
  frame.style.visibility = 'visible';
  frame.style.opacity = '1';
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = 'none';
  frame.style.background = '#0b1021';
  frame.style.pointerEvents = 'auto';
  frame.setAttribute('allow', 'clipboard-read; clipboard-write');

  frameShell.appendChild(frame);
  container.appendChild(frameShell);
  document.body.appendChild(container);

  return {
    ref: frame.contentWindow,
    cleanup: () => {
      try {
        container.remove();
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Launch the XKOVA IEE (SafeApprove) iframe and resolve when a receipt (or cancellation/error) is returned.
 *
 * Guards:
 * - Enforces exact origin match for postMessage events.
 * - Enforces matching receipt_request_id on inbound messages.
 * - Tracks a startup `ready` handshake and fails fast when the IEE frame never becomes visible.
 * - Falls back to reading `window.name` from the iframe when postMessage is unavailable.
 * - Uses explicit targetOrigin (no wildcard).
 * - Temporarily re-enables pointer events on the document to avoid modal overlays blocking the IEE (SafeApprove) iframe.
 */
export async function launchIee(params: LaunchIeeParams): Promise<LaunchIeeResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('launchIee requires a browser environment.');
  }

  const expectedOrigin = normalizeOrigin(params.expectedIeeOrigin, window.location.href);
  if (!expectedOrigin || expectedOrigin === '*') {
    throw new Error('expectedIeeOrigin must be a valid, non-wildcard origin.');
  }

  const returnOrigin = normalizeOrigin(
    params.returnOrigin ?? window.location.origin,
    window.location.href,
  );
  if (!returnOrigin) {
    throw new Error('returnOrigin could not be determined.');
  }

  const restorePointerEvents = overridePointerEvents();
  const ieeUrl = buildIeeUrl(params, returnOrigin);
  const child = openIframe(ieeUrl);

  if (!child.ref) {
    child.cleanup();
    restorePointerEvents();
    return {
      status: 'error',
      error: {
        code: 'IFRAME_FAILED',
        message: 'The SafeApprove iframe could not be opened. Please try again.',
      },
    };
  }

  return await new Promise<LaunchIeeResult>((resolve) => {
    const timeoutMs = Number.isFinite(params.timeoutMs)
      ? Math.max(0, Number(params.timeoutMs))
      : DEFAULT_TIMEOUT_MS;
    const readyTimeoutMs = Math.max(
      MIN_READY_TIMEOUT_MS,
      Math.min(MAX_READY_TIMEOUT_MS, Math.floor(timeoutMs / 3)),
    );
    let isReady = false;

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({
        status: 'error',
        error: {
          code: 'TIMEOUT',
          message: 'SafeApprove did not respond before the timeout expired.',
        },
      });
    }, timeoutMs);
    const readyTimeoutId = window.setTimeout(() => {
      if (isReady) return;
      resolveError(
        'IEE_WINDOW_HIDDEN',
        'SafeApprove did not become visible. Check iframe embedding/origin allowlists and browser privacy settings, then retry.',
      );
    }, readyTimeoutMs);
    const readyProbe = {
      type: 'xkova_iee_init',
      receipt_request_id: params.receiptRequestId,
    };
    const postReadyProbe = () => {
      try {
        child.ref?.postMessage(readyProbe, expectedOrigin);
      } catch {
        // ignore
      }
    };
    postReadyProbe();
    const readyProbeId = window.setInterval(postReadyProbe, 600);
    const abortHandler = () => {
      cleanup();
      resolve({
        status: 'error',
        error: { code: 'ABORTED', message: 'SafeApprove launch was aborted.' },
      });
    };

    if (params.signal) {
      if (params.signal.aborted) {
        abortHandler();
        return;
      }
      params.signal.addEventListener('abort', abortHandler);
    }

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.clearTimeout(readyTimeoutId);
      window.clearInterval(namePollId);
      window.clearInterval(readyProbeId);
      window.removeEventListener('message', onMessage);
      params.signal?.removeEventListener('abort', abortHandler);
      child.cleanup();
      restorePointerEvents();
    }

    function resolveError(code: string, message: string) {
      cleanup();
      resolve({ status: 'error', error: { code, message } });
    }

    function resolveFromData(data: Record<string, unknown>): boolean {
      if (!data || data['receipt_request_id'] !== params.receiptRequestId) {
        return false;
      }

      const status = data['status'];
      if (status === 'ready') {
        isReady = true;
        window.clearTimeout(readyTimeoutId);
        return false;
      }

      if (status === 'cancelled') {
        cleanup();
        resolve({ status: 'cancelled' });
        return true;
      }

      if (status === 'approved') {
        const receipt = typeof data['receipt'] === 'string' ? data['receipt'] : null;
        if (!receipt) {
          resolveError('IEE_INVALID_PAYLOAD', 'SafeApprove approved without a receipt payload.');
          return true;
        }

        cleanup();
        resolve({
          status: 'approved',
          receipt,
          actionType: typeof data['action_type'] === 'string' ? (data['action_type'] as string) : undefined,
          actionHash: typeof data['action_hash'] === 'string' ? (data['action_hash'] as string) : undefined,
          jti: typeof data['jti'] === 'string' ? (data['jti'] as string) : undefined,
          receiptExpiresAt: typeof data['receipt_expires_at'] === 'number'
            ? (data['receipt_expires_at'] as number)
            : undefined,
          contextHash: (data as any)['context_hash'] ?? (data as any)['contextHash'] ?? null,
          txIntent: (data as any)['tx_intent'] ?? (data as any)['txIntent'] ?? null,
          userOpHash: (data as any)['userOpHash'] ?? null,
          transactionHash:
            (data as any)['transactionHash'] ??
            (data as any)['transaction_hash'] ??
            null,
          preparationToken:
            (data as any)['preparationToken'] ??
            (data as any)['preparation_token'] ??
            null,
          installationId:
            (data as any)['installationId'] ??
            (data as any)['installation_id'] ??
            null,
          resolvedPayload: (data as any)['resolved_payload'] ?? null,
        });
        return true;
      }

      if (status === 'error') {
        const err = (data['error'] as { code?: string; message?: string } | undefined) || {};
        resolveError(err.code || 'IEE_ERROR', err.message || 'SafeApprove returned an error.');
        return true;
      }

      resolveError('IEE_UNKNOWN', 'Received an unexpected response from the SafeApprove window.');
      return true;
    }

    function readNamePayload() {
      if (!child.ref) return false;
      let rawName: string;
      try {
        rawName = child.ref.name;
      } catch {
        return false;
      }
      if (!rawName || rawName === 'xkova-iee') return false;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawName) as Record<string, unknown>;
      } catch {
        return false;
      }
      return resolveFromData(parsed);
    }

    function onMessage(event: MessageEvent) {
      const data = getTrustedIeeMessageData({
        expectedOrigin,
        receiptRequestId: params.receiptRequestId,
        event,
      });
      if (!data) {
        return;
      }
      resolveFromData(data);
    }

    window.addEventListener('message', onMessage);

    const namePollId = window.setInterval(() => {
      if (readNamePayload()) {
        return;
      }
      if (child.ref && child.ref.closed) {
        readNamePayload();
      }
    }, 250);
  });
}

/**
 * Build a browser receipt provider for non-React flows.
 *
 * @remarks
 * Purpose:
 * - Create prep tickets with oauth-server, launch the IEE (SafeApprove) modal, and normalize receipt outcomes.
 *
 * When to use:
 * - Use in non-React browser apps with {@link IeeOrchestrator}.
 *
 * When not to use:
 * - Do not use in SSR/Node environments; requires DOM and window.postMessage.
 *
 * Parameters:
 * - `options`: BrowserIeeReceiptProviderOptions. Nullable: no.
 *
 * Return semantics:
 * - Returns an {@link IeeReceiptProvider}-compatible adapter.
 *
 * Errors/failure modes:
 * - Throws when auth configuration is missing or invalid.
 * - Returns `{ status: "error" }` when ticket issuance or IEE (SafeApprove) launch fails.
 *
 * Side effects:
 * - Issues an OAuth request to `/iee/tickets`.
 * - Opens the IEE (SafeApprove) iframe modal via {@link launchIee}.
 */
export const createBrowserIeeReceiptProvider = (
  options: BrowserIeeReceiptProviderOptions,
): IeeReceiptProvider => {
  const ieeService = resolveIeeService(options);
  const expectedOrigin = resolveExpectedOrigin(options.ieeUrl, options.expectedIeeOrigin);

  if (!expectedOrigin) {
    throw new Error("expectedIeeOrigin must resolve to a valid origin.");
  }

  return {
    getReceipt: async (params: IeeReceiptProviderParams) => {
      try {
        const ticket = await ieeService.createPrepTicket({
          actionType: params.serverActionType,
          payload: params.payload,
        });

        const result = await launchIee({
          ieeUrl: options.ieeUrl,
          expectedIeeOrigin: expectedOrigin,
          receiptRequestId: params.receiptRequestId ?? "",
          ticketId: ticket.ticketId,
          draftId: options.draftId,
          timeoutMs: options.timeoutMs,
          returnOrigin: options.returnOrigin,
        });

        return normalizeLaunchResult(result);
      } catch (error) {
        return {
          status: "error",
          error: {
            code: "IEE_PROVIDER_ERROR",
            message:
              error instanceof Error ? error.message : "SafeApprove receipt provider failed.",
          },
        };
      }
    },
  };
};
