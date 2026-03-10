import { ValidationError } from "./errors.js";
/**
 * Normalize a tenant auth domain into an absolute origin.
 *
 * @remarks
 * Purpose:
 * - Convert tenant auth-domain values (host-only or absolute URL) into a usable origin.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain (host-only or absolute URL).
 * - `options.defaultProtocol`: Optional protocol override for host-only inputs.
 *
 * Return semantics:
 * - Returns an origin string like `https://auth.example.com` or `http://localhost:3000`.
 * - Returns null when the input is empty.
 *
 * Errors/failure modes:
 * - Best-effort parsing; invalid absolute URLs fall back to trimmed input.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Returned origin does not include a trailing slash.
 */
export const normalizeTenantAuthBaseUrl = (authDomain, options) => {
    const raw = String(authDomain ?? "").trim();
    if (!raw)
        return null;
    if (raw.includes("://")) {
        try {
            return new URL(raw).origin;
        }
        catch {
            return raw.replace(/\/$/, "");
        }
    }
    const hostOnly = raw.replace(/\/+$/, "");
    const hostname = hostOnly.split(":")[0]?.toLowerCase() ?? "";
    const isLocalhostHost = hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.endsWith(".localhost");
    const protocol = isLocalhostHost
        ? options?.defaultProtocol ?? "http:"
        : "https:";
    return `${protocol}//${hostOnly}`;
};
/**
 * Build a hosted email-change URL on the tenant auth domain.
 *
 * @remarks
 * Purpose:
 * - Construct a stable hosted email-change URL for browser navigation.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain (host-only or absolute URL). Required.
 * - `returnTo`: Optional return URL passed as `return_to` query param.
 * - `path`: Optional path override (defaults to `/email-change`).
 * - `defaultProtocol`: Optional protocol override for host-only inputs.
 *
 * Return semantics:
 * - Returns an absolute URL string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when `authDomain` is missing or invalid.
 *
 * Side effects:
 * - None.
 */
export const resolveHostedEmailChangeUrl = (params) => {
    const authBase = normalizeTenantAuthBaseUrl(params?.authDomain, {
        defaultProtocol: params?.defaultProtocol,
    });
    if (!authBase) {
        throw new ValidationError("authDomain is required");
    }
    const path = String(params?.path ?? "/email-change").trim() || "/email-change";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, authBase);
    const returnTo = typeof params?.returnTo === "string" ? params.returnTo.trim() : "";
    if (returnTo) {
        url.searchParams.set("return_to", returnTo);
    }
    return url.toString();
};
/**
 * Build a hosted handle-change URL on the tenant auth domain.
 *
 * @remarks
 * Purpose:
 * - Construct a stable hosted handle-change URL for browser navigation.
 *
 * Parameters:
 * - `authDomain`: Tenant auth domain (host-only or absolute URL). Required.
 * - `returnTo`: Optional return URL passed as `return_to` query param.
 * - `path`: Optional path override (defaults to `/change-handle`).
 * - `defaultProtocol`: Optional protocol override for host-only inputs.
 *
 * Return semantics:
 * - Returns an absolute URL string.
 *
 * Errors/failure modes:
 * - Throws ValidationError when `authDomain` is missing or invalid.
 *
 * Side effects:
 * - None.
 */
export const resolveHostedHandleChangeUrl = (params) => {
    const authBase = normalizeTenantAuthBaseUrl(params?.authDomain, {
        defaultProtocol: params?.defaultProtocol,
    });
    if (!authBase) {
        throw new ValidationError("authDomain is required");
    }
    const path = String(params?.path ?? "/change-handle").trim() || "/change-handle";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, authBase);
    const returnTo = typeof params?.returnTo === "string" ? params.returnTo.trim() : "";
    if (returnTo) {
        url.searchParams.set("return_to", returnTo);
    }
    return url.toString();
};
