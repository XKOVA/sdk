const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry configuration for HTTP requests.
 *
 * @remarks
 * Purpose:
 * - Configure retry behavior for transient network and status failures.
 *
 * When to use:
 * - Use when you need custom retry/backoff behavior for SDK transport.
 *
 * When not to use:
 * - Do not enable aggressive retries for non-idempotent endpoints unless you understand side effects.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None directly; applied by fetchWithPolicy.
 *
 * Invariants/assumptions:
 * - Retry counts are non-negative integers when provided.
 *
 * Data/auth references:
 * - Retry policy applies to apps/api and oauth-server requests.
 */
export type RetryOptions = {
  /**
   * Number of retries AFTER the initial attempt.
   * Default: 2
   */
  retries?: number;
  /**
   * Base backoff in ms. Default: 300
   */
  backoffMs?: number;
  /**
   * Maximum backoff in ms. Default: 3000
   */
  maxBackoffMs?: number;
  /**
   * Retryable methods. Default: GET/HEAD/OPTIONS
   */
  methods?: string[];
  /**
   * Retry when response status matches. Default: 408, 429, 5xx
   */
  retryOnStatus?: (status: number) => boolean;
  /**
   * When true, honors Retry-After for retryable status responses.
   * Default: false.
   */
  respectRetryAfter?: boolean;
};

/**
 * Request policy configuration for timeout and retry handling.
 *
 * @remarks
 * Purpose:
 * - Define total timeout budgets, per-attempt timeouts, and retry rules.
 *
 * When to use:
 * - Use when customizing transport behavior for API clients or OAuth flows.
 *
 * When not to use:
 * - Do not set timeouts to zero unless you explicitly want no timeout.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type shape only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None directly; applied by fetchWithPolicy.
 *
 * Invariants/assumptions:
 * - Timeouts are in milliseconds.
 *
 * Data/auth references:
 * - Applies to HTTP requests made by the SDK.
 */
export type RequestPolicy = {
  /**
   * Total timeout budget for the whole request (including retries/backoff), in ms.
   * Default: 30000
   */
  timeoutMs?: number;
  /**
   * Per-attempt timeout in ms. Default: 10000
   * This is capped by the remaining total timeout budget.
   */
  attemptTimeoutMs?: number;
  retry?: RetryOptions;
  /**
   * If true, allows retry for non-idempotent methods (POST/PUT/PATCH/DELETE).
   * Default: false (secure/boring).
   */
  allowRetryForNonIdempotent?: boolean;
  /**
   * Optional observability hooks for attempts/retries (no logging by default).
   */
  hooks?: {
    onAttemptStart?: (ctx: { url: string; method: string; attempt: number; maxRetries: number }) => void;
    onRetry?: (ctx: {
      url: string;
      method: string;
      attempt: number;
      maxRetries: number;
      waitMs: number;
      reason: { kind: "status"; status: number } | { kind: "network" };
    }) => void;
    onAttemptEnd?: (ctx: { url: string; method: string; attempt: number; status?: number; error?: unknown }) => void;
  };
};

function isAbortLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as any;
  return e?.name === "AbortError";
}

function shouldRetryStatusDefault(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function computeBackoffMs(attempt: number, opts: { backoffMs: number; maxBackoffMs: number }) {
  // Exponential backoff with jitter.
  const exp = opts.backoffMs * Math.pow(2, attempt);
  const capped = Math.min(opts.maxBackoffMs, exp);
  // Full jitter: random in [0, capped]
  return Math.floor(Math.random() * capped);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.floor(seconds * 1000));
  }
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

function createAbortError(message: string) {
  // DOMException may not exist in all runtimes (node).
  try {
    // eslint-disable-next-line no-undef
    return new DOMException(message, "AbortError");
  } catch {
    const err = new Error(message);
    (err as any).name = "AbortError";
    return err;
  }
}

function createTimeoutSignal(parent: AbortSignal | null | undefined, timeoutMs: number | undefined) {
  if (!timeoutMs || timeoutMs <= 0) {
    return { signal: parent, cleanup: () => {} };
  }

  const controller = new AbortController();

  const onAbort = () => {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  };

  if (parent) {
    if (parent.aborted) {
      onAbort();
      return { signal: controller.signal, cleanup: () => {} };
    }
    if (typeof (parent as any).addEventListener === "function") {
      (parent as any).addEventListener("abort", onAbort, { once: true });
    }
  }

  const t = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(t);
    if (parent && typeof (parent as any).removeEventListener === "function") {
      (parent as any).removeEventListener("abort", onAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

/**
 * Fetch wrapper with timeout and retry policy.
 *
 * @remarks
 * Purpose:
 * - Provide a single request helper with retries, backoff, and timeouts.
 *
 * When to use:
 * - Use in SDK internals or custom API clients that need consistent retry behavior.
 *
 * When not to use:
 * - Do not use for non-idempotent requests unless you opt in to retries explicitly.
 *
 * Parameters:
 * - `fetchFn`: Fetch implementation (browser or Node 18+). Nullable: no.
 * - `url`: Absolute or relative URL. Nullable: no.
 * - `init`: Fetch init options. Nullable: yes.
 * - `policy`: RequestPolicy configuration. Nullable: yes.
 *
 * Return semantics:
 * - Resolves with a Response (successful or error status).
 *
 * Errors/failure modes:
 * - Throws on timeout or when retryable attempts are exhausted.
 * - Throws AbortError when an AbortSignal cancels the request.
 *
 * Side effects:
 * - Performs network requests and may delay between retries.
 *
 * Invariants/assumptions:
 * - Retries are idempotent-only by default (GET/HEAD/OPTIONS).
 *
 * Data/auth references:
 * - Requests may include authorization headers provided by the caller.
 */
export async function fetchWithPolicy(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
  policy?: RequestPolicy,
): Promise<Response> {
  // Industry-standard approach: a total timeout budget + per-attempt timeout.
  // Defaults: 30s total, 10s per attempt.
  const totalTimeoutMs = policy?.timeoutMs ?? 30_000;
  const attemptTimeoutMs = policy?.attemptTimeoutMs ?? 10_000;
  const deadline = totalTimeoutMs > 0 ? Date.now() + totalTimeoutMs : null;

  const retry = policy?.retry ?? {};
  const retries = retry.retries ?? 2;
  const backoffMs = retry.backoffMs ?? 300;
  const maxBackoffMs = retry.maxBackoffMs ?? 3_000;
  const retryOnStatus = retry.retryOnStatus ?? shouldRetryStatusDefault;
  const respectRetryAfter = retry.respectRetryAfter === true;
  const retryMethods = (retry.methods ?? ["GET", "HEAD", "OPTIONS"]).map((m) => m.toUpperCase());

  const method = (init?.method ?? "GET").toUpperCase();
  const isRetryableMethod =
    retryMethods.includes(method) || policy?.allowRetryForNonIdempotent === true;

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    policy?.hooks?.onAttemptStart?.({ url, method, attempt, maxRetries: retries });
    const remainingTotal =
      deadline == null ? null : Math.max(0, deadline - Date.now());
    if (remainingTotal != null && remainingTotal <= 0) {
      const err = createAbortError("Request timed out");
      policy?.hooks?.onAttemptEnd?.({ url, method, attempt, error: err });
      throw err;
    }

    const effectiveAttemptTimeout =
      remainingTotal == null
        ? attemptTimeoutMs
        : Math.min(attemptTimeoutMs, remainingTotal);

    const { signal, cleanup } = createTimeoutSignal(init?.signal ?? undefined, effectiveAttemptTimeout);
    try {
      const res = await fetchFn(url, { ...init, signal });
      cleanup();

      if (res.ok) return res;

      if (isRetryableMethod && attempt < retries && retryOnStatus(res.status)) {
        try {
          // Avoid leaking open streams on retry.
          res.body?.cancel?.();
        } catch {
          /* ignore */
        }
        const retryAfterMs = respectRetryAfter
          ? parseRetryAfter(res.headers.get("retry-after"))
          : null;
        const wait =
          retryAfterMs != null
            ? retryAfterMs
            : computeBackoffMs(attempt, { backoffMs, maxBackoffMs });
        policy?.hooks?.onRetry?.({
          url,
          method,
          attempt,
          maxRetries: retries,
          waitMs: wait,
          reason: { kind: "status", status: res.status },
        });
        attempt += 1;
        await delay(wait);
        continue;
      }

      policy?.hooks?.onAttemptEnd?.({ url, method, attempt, status: res.status });
      return res;
    } catch (err) {
      cleanup();

      // Do not retry aborted/timeouts; surface immediately.
      if ((signal && signal.aborted) || isAbortLike(err)) {
        policy?.hooks?.onAttemptEnd?.({ url, method, attempt, error: err });
        throw err;
      }

      if (!isRetryableMethod || attempt >= retries) {
        policy?.hooks?.onAttemptEnd?.({ url, method, attempt, error: err });
        throw err;
      }

      const wait = computeBackoffMs(attempt, { backoffMs, maxBackoffMs });
      policy?.hooks?.onRetry?.({ url, method, attempt, maxRetries: retries, waitMs: wait, reason: { kind: "network" } });
      attempt += 1;
      await delay(wait);
    }
  }
}

/**
 * Legacy helper that wraps global fetch with retry defaults.
 *
 * @remarks
 * Purpose:
 * - Provide a lightweight compatibility wrapper around fetchWithPolicy.
 *
 * When to use:
 * - Use only in legacy integrations that expect the older signature.
 *
 * When not to use:
 * - Prefer fetchWithPolicy with a RequestPolicy for new integrations.
 *
 * Parameters:
 * - `url`: Request URL. Nullable: no.
 * - `init`: Fetch init options. Nullable: yes.
 * - `retries`: Number of retries after the initial attempt. Nullable: yes.
 * - `backoffMs`: Base backoff in milliseconds. Nullable: yes.
 *
 * Return semantics:
 * - Resolves with a Response (successful or error status).
 *
 * Errors/failure modes:
 * - Throws on timeout, abort, or when retries are exhausted.
 *
 * Side effects:
 * - Performs network requests and delays between retries.
 *
 * Invariants/assumptions:
 * - Retries are idempotent-only by default.
 *
 * Data/auth references:
 * - Requests may include authorization headers provided by the caller.
 */
