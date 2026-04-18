import { randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const TOKEN_REFRESH_WINDOW_MS = 30_000;
export const XKOVA_ENV_TO_AUTH_URL = Object.freeze({
  production: 'https://core.xkova.com',
  staging: 'https://staging-core.xkova.com',
  dev: 'https://dev-core.xkova.com',
  local: 'https://local-core.xkova.com',
});

type AnyRecord = Record<string, any>;
type UnknownRecord = Record<string, unknown>;
type TransactionLifecycleEvent = 'transaction.submitted' | 'transaction.finalized';

export type XkovaEnvironment = 'production' | 'staging' | 'dev' | 'local';
export type TokenBudgetMode = 'single' | 'all';

export interface AgentLogger {
  info(message: string, meta?: AnyRecord): void;
  warn(message: string, meta?: AnyRecord): void;
  error(message: string, meta?: AnyRecord): void;
}

export interface HttpErrorOptions {
  url?: string;
  status?: number;
  bodySnippet?: string;
}

export interface ResolveJwksUrlOptions {
  jwksUrl?: string | null;
  agentpassBaseUrl?: string | null;
  xkovaEnv?: unknown;
}

export interface NumberConstraints {
  min?: number;
  max?: number;
}

export interface NormalizedTransactionLifecyclePayload {
  event: TransactionLifecycleEvent;
  installationId: string;
  transactionId: string;
  queueId: string | null;
  status: string | null;
  transactionHash: string | null;
  userOpHash: string | null;
  blockNumber: string | null;
  gasUsed: string | null;
  minedAt: string | null;
  revertReason: string | null;
  submittedAt: string | null;
  finalizedAt: string | null;
}

export interface InstallationOperatingToken {
  token_pool_id: string;
  symbol: string | null;
  name: string | null;
  contract: string | null;
  decimals: number | null;
  is_stable: boolean | null;
  network_pool_id: string | null;
  [key: string]: unknown;
}

export interface NormalizedInstallationPayload {
  installationId: string | number;
  agentActorId?: string | number;
  tenant_id?: string | number;
  status?: string;
  pause_code?: unknown | null;
  revoke_reason?: unknown | null;
  webhook_pending?: boolean;
  network?: unknown | null;
  selected_token_pool_id?: string | null;
  available_operating_tokens?: InstallationOperatingToken[];
  token_budgets_by_token_pool_id?: Record<string, string> | null;
  token_budget_mode?: TokenBudgetMode | null;
  install_inputs?: UnknownRecord | null;
  install_questions_version?: number | null;
}

export interface ParsedTransactionWebhookPayload {
  kind: 'transaction';
  payload: NormalizedTransactionLifecyclePayload;
}

export interface ParsedInstallationWebhookPayload {
  kind: 'installation';
  payload: NormalizedInstallationPayload;
}

export type ParsedAgentWebhookPayload =
  | ParsedTransactionWebhookPayload
  | ParsedInstallationWebhookPayload;

export interface InstallationTokenResolutionContext extends UnknownRecord {
  available_operating_tokens?: unknown;
  install_inputs?: UnknownRecord | null;
  selected_token_pool_id?: unknown;
}

export interface ResolvedInstallationToken extends AnyRecord {
  token_pool_id: string;
}

export interface ResolveInstallationTokenParams {
  installation?: InstallationTokenResolutionContext | null;
  preferredTokenPoolId?: string | null;
  preferredSymbol?: string | null;
  installInputKey?: string;
}

export interface BuildErc20TransferTxParams {
  network?: {
    network_id?: number | string | null;
    chain_id?: number | string | null;
    [key: string]: unknown;
  } | null;
  token?: {
    contract?: string | null;
    address?: string | null;
    decimals?: number | null;
    [key: string]: unknown;
  } | null;
  installInputs?: UnknownRecord | null;
  targetAccount: string;
  defaultAmountTokenUnits: number;
  amountInputKey?: string;
}

export interface BuiltErc20TransferTx {
  to: string;
  data: string;
  value: '0';
  network_id?: number;
}

interface ServiceAuthParams {
  agentpassBaseUrl: string;
  serviceId: string;
  serviceCredential: string;
  logger?: AgentLogger;
}

export interface ListServiceInstallationsParams extends ServiceAuthParams {}

export interface IssueInstallationTokenParams extends ServiceAuthParams {
  installationId: string;
}

export interface IssueInstallationTokenResult {
  token: string;
  expiresIn: number;
}

export interface SignManagedTransactionParams {
  agentpassBaseUrl: string;
  agentActorId: string;
  installationJwt: string;
  transaction: UnknownRecord;
  idempotencyKey?: string;
  logger?: AgentLogger;
}

export type SignManagedTransactionResult = UnknownRecord & {
  idempotency_key: string;
};

export interface CreateJwksWebhookVerifierOptions extends ResolveJwksUrlOptions {
  issuer?: string | null;
  audience?: string | string[] | null;
  algorithms?: string[] | null;
}

export interface WebhookRequestLike {
  headers?: ({ authorization?: string | string[]; Authorization?: string | string[] } & UnknownRecord) | null;
}

export type JwksWebhookVerifier = (input?: { req?: WebhookRequestLike | null } | null) => Promise<boolean>;

const defaultLogger: AgentLogger = {
  info(message, meta) {
    if (meta) {
      console.log(`[sdk-agent] ${message}`, meta);
      return;
    }
    console.log(`[sdk-agent] ${message}`);
  },
  warn(message, meta) {
    if (meta) {
      console.warn(`[sdk-agent] ${message}`, meta);
      return;
    }
    console.warn(`[sdk-agent] ${message}`);
  },
  error(message, meta) {
    if (meta) {
      console.error(`[sdk-agent] ${message}`, meta);
      return;
    }
    console.error(`[sdk-agent] ${message}`);
  },
};

/**
 * Error thrown for non-2xx HTTP responses.
 */
export class HttpError extends Error {
  url?: string;
  status?: number;
  bodySnippet?: string;

  constructor(message: string, { url, status, bodySnippet }: HttpErrorOptions = {}) {
    super(message);
    this.name = 'HttpError';
    this.url = url;
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function jitter(ms: number, ratio = 0.2): number {
  const delta = ms * ratio;
  const min = ms - delta;
  const max = ms + delta;
  return Math.max(0, Math.floor(min + Math.random() * (max - min)));
}

function computeBackoffMs(baseMs: number, attempt: number, maxMs = 5_000): number {
  const exp = baseMs * Math.pow(2, attempt - 1);
  return Math.min(maxMs, exp);
}

async function readBodySnippet(res: Response, maxChars = 800): Promise<string> {
  try {
    const raw = await res.text();
    if (!raw) return '';
    const trimmed = raw.trim();
    const isHtml = /^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed);
    const snippet =
      trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…(truncated)` : trimmed;
    return isHtml ? `HTML error body: ${snippet}` : snippet;
  } catch {
    return '';
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 2, backoffMs = 300, logger: AgentLogger = defaultLogger): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if ((res.status >= 500 || res.status === 429 || res.status === 408) && attempt < retries) {
        attempt += 1;
        const wait = jitter(computeBackoffMs(backoffMs, attempt));
        logger.warn('Retrying request', { url, status: res.status, attempt, wait });
        await delay(wait);
        continue;
      }
      return res;
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
      const wait = jitter(computeBackoffMs(backoffMs, attempt));
      logger.warn('Retrying network failure', {
        url,
        attempt,
        wait,
        error: (error as { message?: string } | null)?.message,
      });
      await delay(wait);
    }
  }
}

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return String(value);
  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const XKOVA_ENVIRONMENT_KEYS = Object.keys(
  XKOVA_ENV_TO_AUTH_URL,
) as XkovaEnvironment[];

const XKOVA_ENVIRONMENT_HINT = XKOVA_ENVIRONMENT_KEYS.join(', ');

/**
 * Normalize and validate an XKOVA environment key.
 *
 * @param rawValue - Environment value to normalize.
 * @returns One of `production`, `staging`, `dev`, or `local`.
 * @throws Error when env is missing or unknown.
 */
export function resolveXkovaEnvironment(rawValue: unknown): XkovaEnvironment {
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  if (!normalized) {
    throw new Error(
      `xkovaEnv is required. Set one of: ${XKOVA_ENVIRONMENT_HINT}`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(XKOVA_ENV_TO_AUTH_URL, normalized)) {
    return normalized as XkovaEnvironment;
  }
  throw new Error(
    `Unsupported xkovaEnv "${String(rawValue)}". Expected one of: ${XKOVA_ENVIRONMENT_HINT}`,
  );
}

/**
 * Resolve the OAuth base URL from an XKOVA environment value.
 *
 * @param rawValue - Environment key value.
 * @returns Base URL for the selected environment.
 */
export function resolveAgentpassBaseUrl(rawValue: unknown): string {
  const env = resolveXkovaEnvironment(rawValue);
  return XKOVA_ENV_TO_AUTH_URL[env];
}

function normalizeCoreBaseUrl(input: string): string {
  if (!input) {
    throw new Error('agentpassBaseUrl is required');
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('agentpassBaseUrl must be a valid absolute URL');
  }

  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/auth') {
    throw new Error('agentpassBaseUrl must be the core origin or /auth base URL');
  }

  return `${url.protocol}//${url.host}`;
}

/**
 * Resolve JWKS URL using explicit input or derived environment defaults.
 *
 * @param options - Resolution options.
 * @returns Absolute JWKS URL.
 */
export function resolveJwksUrl(options: ResolveJwksUrlOptions = {}): string {
  const explicitJwks = String(options?.jwksUrl ?? '').trim();
  if (explicitJwks) {
    return explicitJwks;
  }

  const explicitBase = String(options?.agentpassBaseUrl ?? '').trim();
  const baseUrl = explicitBase || resolveAgentpassBaseUrl(options?.xkovaEnv);
  const coreBaseUrl = normalizeCoreBaseUrl(baseUrl);
  return `${coreBaseUrl}/auth/.well-known/jwks.json`;
}

function normalizeInstallQuestionsVersion(value: unknown): number | null {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function normalizeAvailableOperatingTokens(value: unknown): InstallationOperatingToken[] | undefined {
  if (value == null) return [];
  if (!Array.isArray(value)) return undefined;

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const tokenPoolId =
        typeof entry.token_pool_id === 'string'
          ? entry.token_pool_id.trim()
          : typeof entry.tokenPoolId === 'string'
            ? entry.tokenPoolId.trim()
            : '';
      if (!tokenPoolId) return null;
      const contract =
        typeof entry.contract === 'string'
          ? entry.contract
          : typeof entry.address === 'string'
            ? entry.address
            : null;
      return {
        ...entry,
        token_pool_id: tokenPoolId,
        symbol: typeof entry.symbol === 'string' ? entry.symbol : null,
        name: typeof entry.name === 'string' ? entry.name : null,
        contract,
        decimals: typeof entry.decimals === 'number' ? entry.decimals : null,
        is_stable: typeof entry.is_stable === 'boolean' ? entry.is_stable : null,
        network_pool_id:
          typeof entry.network_pool_id === 'string'
            ? entry.network_pool_id
            : typeof entry.networkPoolId === 'string'
              ? entry.networkPoolId
              : null,
      } as InstallationOperatingToken;
    })
    .filter((entry): entry is InstallationOperatingToken => Boolean(entry?.token_pool_id));
}

function normalizeTokenBudgetsByTokenPoolId(
  value: unknown,
): Record<string, string> | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const normalized: Record<string, string> = {};
  for (const [rawTokenPoolId, rawBudget] of Object.entries(value)) {
    const tokenPoolId = String(rawTokenPoolId ?? '').trim();
    const budget = String(rawBudget ?? '').trim();
    if (!tokenPoolId || !/^\d+$/.test(budget)) continue;
    normalized[tokenPoolId] = budget;
  }
  return normalized;
}

function normalizeTokenBudgetMode(value: unknown): TokenBudgetMode | null | undefined {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'single' || normalized === 'all') {
    return normalized;
  }
  return undefined;
}

/**
 * Normalize one installation payload into a canonical in-memory shape.
 *
 * Preserves canonical token metadata fields when available:
 * - `selected_token_pool_id`
 * - `available_operating_tokens`
 * - `token_budgets_by_token_pool_id`
 * - `token_budget_mode`
 *
 * @param payload - Installation payload from webhook or list endpoint.
 * @returns Normalized installation object or null when installation id is missing.
 */
export function normalizeInstallationPayload(payload: unknown): NormalizedInstallationPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const rawInstallationId = payload.installationId ?? payload.installation_id;
  if (
    rawInstallationId === undefined ||
    rawInstallationId === null ||
    rawInstallationId === '' ||
    (typeof rawInstallationId !== 'string' && typeof rawInstallationId !== 'number')
  ) {
    return null;
  }
  const installationId: string | number = rawInstallationId;

  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  let webhookPending: unknown;
  if (hasOwn('webhook_pending')) {
    webhookPending = payload.webhook_pending;
  } else if (hasOwn('webhookPending')) {
    webhookPending = payload.webhookPending;
  }
  if (typeof webhookPending === 'string') {
    webhookPending = webhookPending.toLowerCase() === 'true';
  }

  const normalizeInstallInputs = (value: unknown): UnknownRecord | null | undefined => {
    if (value == null) return null;
    if (isRecord(value)) {
      return value;
    }
    return undefined;
  };

  const installInputs = hasOwn('install_inputs')
    ? normalizeInstallInputs(payload.install_inputs)
    : hasOwn('installInputs')
      ? normalizeInstallInputs(payload.installInputs)
      : undefined;

  const installQuestionsVersion = hasOwn('install_questions_version')
    ? normalizeInstallQuestionsVersion(payload.install_questions_version)
    : hasOwn('installQuestionsVersion')
      ? normalizeInstallQuestionsVersion(payload.installQuestionsVersion)
      : undefined;
  const selectedTokenPoolId = hasOwn('selected_token_pool_id')
    ? toOptionalString(payload.selected_token_pool_id)
    : hasOwn('selectedTokenPoolId')
      ? toOptionalString(payload.selectedTokenPoolId)
      : undefined;
  const tokenBudgetsByTokenPoolId = hasOwn('token_budgets_by_token_pool_id')
    ? normalizeTokenBudgetsByTokenPoolId(payload.token_budgets_by_token_pool_id)
    : hasOwn('tokenBudgetsByTokenPoolId')
      ? normalizeTokenBudgetsByTokenPoolId(payload.tokenBudgetsByTokenPoolId)
      : undefined;
  const tokenBudgetMode = hasOwn('token_budget_mode')
    ? normalizeTokenBudgetMode(payload.token_budget_mode)
    : hasOwn('tokenBudgetMode')
      ? normalizeTokenBudgetMode(payload.tokenBudgetMode)
      : undefined;
  const availableOperatingTokens = hasOwn('available_operating_tokens')
    ? normalizeAvailableOperatingTokens(payload.available_operating_tokens)
    : hasOwn('availableOperatingTokens')
      ? normalizeAvailableOperatingTokens(payload.availableOperatingTokens)
      : undefined;

  const normalized: NormalizedInstallationPayload = {
    installationId,
  };

  const agentActorId = payload.agentActorId ?? payload.agent_actor_id ?? null;
  const tenantId = payload.tenantId ?? payload.tenant_id ?? null;

  if (agentActorId !== null && agentActorId !== undefined && agentActorId !== '') {
    normalized.agentActorId = agentActorId as string | number;
  }
  if (tenantId !== null && tenantId !== undefined && tenantId !== '') {
    normalized.tenant_id = tenantId as string | number;
  }
  if (hasOwn('status') && typeof payload.status === 'string') {
    normalized.status = payload.status;
  }
  if (hasOwn('pause_code') || hasOwn('pauseCode')) {
    normalized.pause_code = payload.pause_code ?? payload.pauseCode ?? null;
  }
  if (hasOwn('revoke_reason') || hasOwn('revokeReason')) {
    normalized.revoke_reason = payload.revoke_reason ?? payload.revokeReason ?? null;
  }
  if (webhookPending !== undefined) {
    normalized.webhook_pending = Boolean(webhookPending);
  }
  if (hasOwn('network')) {
    normalized.network = payload.network ?? null;
  } else if (hasOwn('chain')) {
    normalized.network = payload.chain ?? null;
  }
  if (selectedTokenPoolId !== undefined) {
    normalized.selected_token_pool_id = selectedTokenPoolId;
  }
  if (availableOperatingTokens !== undefined) {
    normalized.available_operating_tokens = availableOperatingTokens;
  }
  if (tokenBudgetsByTokenPoolId !== undefined) {
    normalized.token_budgets_by_token_pool_id = tokenBudgetsByTokenPoolId;
  }
  if (tokenBudgetMode !== undefined) {
    normalized.token_budget_mode = tokenBudgetMode;
  }
  if (installInputs !== undefined) {
    normalized.install_inputs = installInputs;
  }
  if (installQuestionsVersion !== undefined) {
    normalized.install_questions_version = installQuestionsVersion;
  }

  return normalized;
}

function base64UrlToBase64(value: unknown): string {
  const str = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad === 0) return str;
  return str + '='.repeat(4 - pad);
}

function decodeJwtPayloadUnsafe(token: unknown): UnknownRecord | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(base64UrlToBase64(parts[1]), 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function tryParseJson(raw: unknown): unknown | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!(text.startsWith('{') || text.startsWith('['))) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Normalize transaction lifecycle webhook payloads.
 *
 * @param body - Decoded webhook payload object.
 * @returns Normalized transaction lifecycle payload or null.
 */
export function normalizeTransactionLifecyclePayload(body: unknown): NormalizedTransactionLifecyclePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const event = typeof body.event === 'string' ? body.event : '';
  if (event !== 'transaction.submitted' && event !== 'transaction.finalized') {
    return null;
  }

  const installationId = toOptionalString(body.installation_id ?? body.installationId);
  const transactionId = toOptionalString(body.transaction_id ?? body.transactionId);
  if (!installationId || !transactionId) {
    return null;
  }

  return {
    event,
    installationId,
    transactionId,
    queueId: toOptionalString(body.queue_id ?? body.queueId),
    status: toOptionalString(body.status),
    transactionHash: toOptionalString(body.transaction_hash ?? body.transactionHash),
    userOpHash: toOptionalString(body.user_op_hash ?? body.userOpHash),
    blockNumber: toOptionalString(body.block_number ?? body.blockNumber),
    gasUsed: toOptionalString(body.gas_used ?? body.gasUsed),
    minedAt: toOptionalString(body.mined_at ?? body.minedAt),
    revertReason: toOptionalString(body.revert_reason ?? body.revertReason),
    submittedAt: toOptionalString(body.submitted_at ?? body.submittedAt),
    finalizedAt: toOptionalString(body.finalized_at ?? body.finalizedAt),
  };
}

function mapWebhookPayloadFromObject(body: unknown): ParsedAgentWebhookPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const transactionPayload = normalizeTransactionLifecyclePayload(body);
  if (transactionPayload) {
    return {
      kind: 'transaction',
      payload: transactionPayload,
    };
  }

  const installationPayload = normalizeInstallationPayload(body);
  if (installationPayload) {
    return {
      kind: 'installation',
      payload: installationPayload,
    };
  }

  return null;
}

function parseWebhookStringPayload(raw: string): UnknownRecord | null {
  const parsed = tryParseJson(raw);
  if (isRecord(parsed)) {
    return parsed;
  }

  return decodeJwtPayloadUnsafe(raw);
}

/**
 * Parse an incoming webhook payload into installation or transaction primitives.
 *
 * @param input - Raw request body string or parsed object payload.
 * @returns Parsed webhook payload wrapper or null when unrecognized.
 */
export function parseAgentWebhookPayload(input: unknown): ParsedAgentWebhookPayload | null {
  if (isRecord(input)) {
    const direct = mapWebhookPayloadFromObject(input);
    if (direct) return direct;

    const maybePayload = input.payload;
    if (typeof maybePayload === 'string') {
      const decoded = parseWebhookStringPayload(maybePayload);
      if (decoded) {
        return mapWebhookPayloadFromObject(decoded);
      }
      return null;
    }
    if (isRecord(maybePayload)) {
      return mapWebhookPayloadFromObject(maybePayload);
    }
  }

  if (typeof input === 'string') {
    const parsed = parseWebhookStringPayload(input);
    if (parsed) {
      const mapped = parseAgentWebhookPayload(parsed);
      if (mapped) return mapped;
    }
  }

  return null;
}

function normalizeSignResponse(payload: unknown): UnknownRecord | null {
  if (!isRecord(payload)) return null;
  return {
    ...payload,
    transactionId: payload.transactionId ?? payload.transaction_id,
    queueId: payload.queueId ?? payload.queue_id,
  };
}

/**
 * Resolve a numeric install input with bounds and fallback.
 *
 * @param inputs - install_inputs object.
 * @param key - install input key.
 * @param fallback - fallback value.
 * @param constraints - optional bounds.
 * @returns Numeric value to use.
 */
export function getInstallInputNumber(
  inputs: AnyRecord | null | undefined,
  key: string,
  fallback: number,
  constraints: NumberConstraints = {},
): number {
  if (!inputs || typeof inputs !== 'object') return fallback;
  const raw = inputs[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const normalizedRaw = typeof raw === 'number' ? String(raw) : String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalizedRaw)) {
    return fallback;
  }
  const value = Number(normalizedRaw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const min = typeof constraints.min === 'number' ? constraints.min : null;
  const max = typeof constraints.max === 'number' ? constraints.max : null;
  if (min !== null && value < min) return fallback;
  if (max !== null && value > max) return fallback;
  return value;
}

function resolveNetworkId(
  network: BuildErc20TransferTxParams['network'],
): number | null {
  const candidate = network?.network_id ?? network?.chain_id ?? null;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string' && candidate.trim()) {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBigIntAmount(amountNumber: number, decimals: number): bigint {
  const factor = BigInt(10) ** BigInt(decimals);
  return (BigInt(Math.round(Number(amountNumber) * 10 ** 6)) * factor) / BigInt(10 ** 6);
}

/**
 * Resolve one operating token from an installation token set.
 *
 * @param params - Resolution inputs.
 * @returns Selected operating token object from `available_operating_tokens`.
 */
export function resolveInstallationToken(
  params: ResolveInstallationTokenParams,
): ResolvedInstallationToken {
  const {
    installation,
    preferredTokenPoolId,
    preferredSymbol,
    installInputKey = 'token_pool_id',
  } = params ?? {};

  const availableTokens = Array.isArray(installation?.available_operating_tokens)
    ? installation.available_operating_tokens
        .map((token): ResolvedInstallationToken | null => {
          if (!isRecord(token)) return null;
          const tokenPoolId =
            typeof token.token_pool_id === 'string'
              ? token.token_pool_id.trim()
              : typeof token.tokenPoolId === 'string'
                ? token.tokenPoolId.trim()
                : '';
          if (!tokenPoolId) return null;
          return {
            ...token,
            token_pool_id: tokenPoolId,
          } as ResolvedInstallationToken;
        })
        .filter((token): token is ResolvedInstallationToken => Boolean(token?.token_pool_id))
    : [];

  if (!availableTokens.length) {
    throw new Error('available_operating_tokens missing from installation payload');
  }

  const byTokenPoolId = new Map(availableTokens.map((token) => [token.token_pool_id, token]));

  const explicitTokenPoolId = String(preferredTokenPoolId ?? '').trim();
  if (explicitTokenPoolId && byTokenPoolId.has(explicitTokenPoolId)) {
    return byTokenPoolId.get(explicitTokenPoolId)!;
  }

  const installInputs = isRecord(installation?.install_inputs)
    ? installation.install_inputs
    : null;
  const installInputTokenPoolId = String(installInputs?.[installInputKey] ?? '').trim();
  if (installInputTokenPoolId && byTokenPoolId.has(installInputTokenPoolId)) {
    return byTokenPoolId.get(installInputTokenPoolId)!;
  }

  const selectedTokenPoolId = String(installation?.selected_token_pool_id ?? '').trim();
  if (selectedTokenPoolId && byTokenPoolId.has(selectedTokenPoolId)) {
    return byTokenPoolId.get(selectedTokenPoolId)!;
  }

  const normalizedSymbol = String(preferredSymbol ?? '').trim().toLowerCase();
  if (normalizedSymbol) {
    const bySymbol = availableTokens.find(
      (token) => String(token.symbol ?? '').trim().toLowerCase() === normalizedSymbol,
    );
    if (bySymbol) return bySymbol;
  }

  return availableTokens[0];
}

/**
 * Build a minimal ERC20 transfer transaction payload for managed signing.
 *
 * @param params - Build parameters.
 * @returns Transaction payload compatible with `/agents/:agentActorId/sign`.
 */
export function buildErc20TransferTx(params: BuildErc20TransferTxParams): BuiltErc20TransferTx {
  const {
    network,
    token,
    installInputs,
    targetAccount,
    defaultAmountTokenUnits,
    amountInputKey = 'amount_token_units',
  } = params;

  const tokenContractRaw =
    typeof token?.contract === 'string'
      ? token.contract
      : typeof token?.address === 'string'
        ? token.address
        : null;
  const tokenContract = tokenContractRaw?.trim().toLowerCase();

  if (!tokenContract) {
    throw new Error('Token contract missing from installation metadata');
  }
  const recipient = String(targetAccount ?? '').trim();
  if (!recipient) {
    throw new Error('targetAccount is required');
  }

  const tokenDecimals = typeof token?.decimals === 'number' ? token.decimals : 6;

  const amountTokenUnits = getInstallInputNumber(
    installInputs,
    amountInputKey,
    defaultAmountTokenUnits,
    { min: 0.01 },
  );

  const methodSelector = 'a9059cbb';
  const paddedTarget = recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountHex = toBigIntAmount(amountTokenUnits, tokenDecimals).toString(16).padStart(64, '0');

  const tx: BuiltErc20TransferTx = {
    to: tokenContract,
    data: `0x${methodSelector}${paddedTarget}${amountHex}`,
    value: '0',
  };

  const networkId = resolveNetworkId(network);
  if (typeof networkId === 'number') {
    tx.network_id = networkId;
  }

  return tx;
}

/**
 * Fetch installations visible to a service credential.
 *
 * @param params - Service credential request parameters.
 * @returns Normalized installation list.
 */
export async function listServiceInstallations(params: ListServiceInstallationsParams): Promise<AnyRecord[]> {
  const { agentpassBaseUrl, serviceId, serviceCredential, logger = defaultLogger } = params;
  const coreBaseUrl = normalizeCoreBaseUrl(agentpassBaseUrl);
  const url = `${coreBaseUrl}/auth/agent-services/${serviceId}/installations/service`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${serviceCredential}`,
      },
    },
    2,
    300,
    logger,
  );

  if (!res.ok) {
    const bodySnippet = await readBodySnippet(res);
    throw new HttpError(`Failed to fetch installations (${res.status})`, {
      url,
      status: res.status,
      bodySnippet: bodySnippet || res.statusText || 'unknown error',
    });
  }

  const payload = await res.json();
  const rows: unknown[] = Array.isArray(payload?.installations) ? payload.installations : [];
  return rows
    .map((row: unknown) => normalizeInstallationPayload(row))
    .filter((row): row is NormalizedInstallationPayload => Boolean(row));
}

/**
 * Issue a short-lived installation JWT for one installation.
 *
 * @param params - Service credential issuance parameters.
 * @returns Installation token response.
 */
export async function issueInstallationToken(params: IssueInstallationTokenParams): Promise<IssueInstallationTokenResult> {
  const { agentpassBaseUrl, serviceId, installationId, serviceCredential, logger = defaultLogger } = params;
  const coreBaseUrl = normalizeCoreBaseUrl(agentpassBaseUrl);
  const url = `${coreBaseUrl}/auth/agent-services/${serviceId}/installations/${installationId}/tokens`;

  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceCredential}`,
        'Content-Type': 'application/json',
      },
    },
    2,
    300,
    logger,
  );

  if (!res.ok) {
    const bodySnippet = await readBodySnippet(res);
    throw new HttpError(`Issuance failed (${res.status})`, {
      url,
      status: res.status,
      bodySnippet: bodySnippet || res.statusText || 'unknown error',
    });
  }

  const payload = await res.json();
  if (!payload?.token || typeof payload?.expires_in !== 'number') {
    throw new Error('Unexpected installation token response shape');
  }

  return {
    token: payload.token,
    expiresIn: payload.expires_in,
  };
}

/**
 * Submit one managed-sign transaction for an installation JWT.
 *
 * @remarks
 * Transport retries are intentionally disabled for this endpoint. Managed
 * signing idempotency keys are strict, and automatic replay of the same key
 * after a failed attempt can convert transient 5xx responses into terminal
 * `IDEMPOTENCY_KEY_ALREADY_USED` errors.
 *
 * @param params - Signing request parameters.
 * @returns Normalized signing response.
 */
export async function signManagedTransaction(params: SignManagedTransactionParams): Promise<SignManagedTransactionResult> {
  const {
    agentpassBaseUrl,
    agentActorId,
    installationJwt,
    transaction,
    idempotencyKey,
    logger = defaultLogger,
  } = params;

  const coreBaseUrl = normalizeCoreBaseUrl(agentpassBaseUrl);
  const url = `${coreBaseUrl}/auth/agents/${agentActorId}/sign`;
  const resolvedIdempotencyKey = idempotencyKey || randomUUID();
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${installationJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction,
        idempotency_key: resolvedIdempotencyKey,
      }),
    },
    0,
    300,
    logger,
  );

  if (!res.ok) {
    const bodySnippet = await readBodySnippet(res);
    throw new HttpError(`Sign failed (${res.status})`, {
      url,
      status: res.status,
      bodySnippet: bodySnippet || res.statusText || 'unknown error',
    });
  }

  const payload = normalizeSignResponse(await res.json());
  if (!payload) {
    throw new Error('Unexpected sign response shape');
  }
  return {
    ...payload,
    idempotency_key: (payload.idempotency_key ?? resolvedIdempotencyKey) as string,
  };
}

/**
 * Check whether a cached token should be refreshed.
 *
 * @param expiresAt - Absolute expiry timestamp in milliseconds.
 * @param now - Current timestamp in milliseconds.
 * @param refreshWindowMs - Refresh window before expiry.
 * @returns True when a new token should be issued.
 */
export function shouldRefreshToken(
  expiresAt: number,
  now = Date.now(),
  refreshWindowMs = TOKEN_REFRESH_WINDOW_MS,
): boolean {
  return !Number.isFinite(expiresAt) || expiresAt - now <= refreshWindowMs;
}

function extractBearerTokenFromRequest(req: WebhookRequestLike | null | undefined): string | null {
  if (!isRecord(req?.headers)) {
    return null;
  }

  const header = req.headers.authorization ?? req.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || typeof value !== 'string') return null;
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice('bearer '.length).trim();
  return token || null;
}

/**
 * Create a JWKS-backed webhook authorization verifier.
 *
 * @param options - Verifier options (`jwksUrl`, `agentpassBaseUrl`, or `xkovaEnv`).
 * @returns Verifier callback that validates bearer JWT signatures.
 */
export function createJwksWebhookVerifier(options: CreateJwksWebhookVerifierOptions = {}): JwksWebhookVerifier {
  const jwksUrl = resolveJwksUrl(options);

  const issuer =
    options?.issuer === undefined || options?.issuer === null
      ? undefined
      : String(options.issuer).trim();
  const audience =
    options?.audience === undefined || options?.audience === null
      ? undefined
      : Array.isArray(options.audience)
        ? options.audience.map((value) => String(value))
        : String(options.audience);
  const normalizedAlgorithms =
    Array.isArray(options?.algorithms) && options.algorithms.length
      ? options.algorithms.map((value) => String(value).trim()).filter(Boolean)
      : [];
  const algorithms = normalizedAlgorithms.length ? normalizedAlgorithms : ['RS256'];

  const jwks = createRemoteJWKSet(new URL(jwksUrl));

  return async (input) => {
    const req = input?.req;
    const token = extractBearerTokenFromRequest(req);
    if (!token) {
      return false;
    }
    try {
      await jwtVerify(token, jwks, {
        algorithms,
        ...(issuer ? { issuer } : {}),
        ...(audience ? { audience } : {}),
      });
      return true;
    } catch {
      return false;
    }
  };
}
