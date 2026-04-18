import { API_VERSION } from "./constants.js";
import { ValidationError } from "./errors.js";

export type CoreRuntimeEnvironment =
  | "local"
  | "dev"
  | "staging"
  | "production"
  | string;

const PRODUCTION_ENV_KEYS = new Set(["production", "prod", "live"]);
const STAGING_ENV_KEYS = new Set(["staging", "stage", "beta", "preprod"]);
const DEV_ENV_KEYS = new Set(["dev", "development"]);
const LOCAL_ENV_KEYS = new Set(["local"]);

const normalizeEnvironmentKey = (raw: unknown): CoreRuntimeEnvironment => {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return "production";
  if (PRODUCTION_ENV_KEYS.has(normalized)) return "production";
  if (STAGING_ENV_KEYS.has(normalized)) return "staging";
  if (DEV_ENV_KEYS.has(normalized)) return "dev";
  if (LOCAL_ENV_KEYS.has(normalized)) return "local";
  return normalized;
};

const sanitizeEnvironmentSegment = (raw: string): string => {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "local";
};

const normalizeCorePathInput = (path: string): string =>
  path.replace(/\/+$/, "") || "/";

/**
 * Resolve a normalized core runtime environment key.
 */
export const resolveCoreRuntimeEnvironment = (
  raw: unknown,
): CoreRuntimeEnvironment => normalizeEnvironmentKey(raw);

/**
 * Resolve the canonical XKOVA core origin for an environment.
 */
export const resolveCoreOriginForEnvironment = (raw: unknown): string => {
  const env = resolveCoreRuntimeEnvironment(raw);
  if (env === "production") return "https://core.xkova.com";
  if (env === "staging") return "https://staging-core.xkova.com";
  if (env === "dev") return "https://dev-core.xkova.com";
  if (env === "local") return "https://local-core.xkova.com";
  return `https://${sanitizeEnvironmentSegment(String(env))}-core.xkova.com`;
};

/**
 * Normalize inputs that may point to core host origin or supported core path roots.
 */
export const normalizeCoreOrigin = (input: string): string => {
  if (!input) {
    throw new ValidationError("core origin is required");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError("core origin must be a valid absolute URL");
  }

  const path = normalizeCorePathInput(url.pathname);
  const allowed =
    path === "/" ||
    path === "/auth" ||
    path === "/auth/oauth" ||
    path === "/api" ||
    /^\/api\/v\d+$/.test(path);
  if (!allowed) {
    throw new ValidationError(
      "core origin must be an origin or a supported /auth or /api path",
    );
  }

  return `${url.protocol}//${url.host}`;
};

/**
 * Resolve the canonical auth base URL (`{coreOrigin}/auth`).
 */
export const resolveCoreAuthBaseUrl = (input: string): string => {
  const origin = normalizeCoreOrigin(input);
  return `${origin}/auth`;
};

/**
 * Resolve the canonical public API base URL (`{coreOrigin}/api/{version}`).
 */
export const resolveCoreApiBaseUrl = (options: {
  coreOrigin: string;
  apiVersion?: string;
}): string => {
  const origin = normalizeCoreOrigin(options.coreOrigin);
  const rawVersion = String(options.apiVersion ?? API_VERSION).trim();
  if (!rawVersion) {
    throw new ValidationError("apiVersion is required");
  }
  const version = rawVersion.replace(/^\/+/, "");
  return `${origin}/api/${version}`;
};
