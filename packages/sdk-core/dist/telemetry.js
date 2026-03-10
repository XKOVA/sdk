/**
 * Generate a request identifier for SDK telemetry.
 *
 * @remarks
 * Purpose:
 * - Provide unique IDs for correlating request attempts.
 *
 * When to use:
 * - Use internally when emitting telemetry for SDK requests.
 *
 * When not to use:
 * - Do not use as a security token; it is not cryptographically strong in all runtimes.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns a unique string identifier.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Uses crypto.randomUUID when available, otherwise a best-effort fallback.
 *
 * Data/auth references:
 * - None.
 */
export function generateRequestId() {
    const c = globalThis?.crypto;
    if (c?.randomUUID)
        return c.randomUUID();
    // Fallback: non-cryptographic but unique enough for tracing.
    return `xkova_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
/**
 * Normalize Headers into a lowercase key/value record for telemetry.
 *
 * @remarks
 * Purpose:
 * - Convert Headers to a serializable object for logging/tracing.
 *
 * When to use:
 * - Use in telemetry adapters when you need to inspect response headers.
 *
 * When not to use:
 * - Do not log sensitive headers without redaction.
 *
 * Parameters:
 * - `headers`: Headers instance to normalize. Nullable: no.
 *
 * Return semantics:
 * - Returns a plain object with lowercase header keys.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Header values are treated as opaque strings.
 *
 * Data/auth references:
 * - Headers may include authorization or session identifiers.
 */
export function headersToRecord(headers) {
    const out = {};
    headers.forEach((value, key) => {
        out[key.toLowerCase()] = value;
    });
    return out;
}
/**
 * Default redaction helper for telemetry payloads.
 *
 * @remarks
 * Purpose:
 * - Remove Authorization/Cookie headers and token-like values from telemetry payloads.
 *
 * When to use:
 * - Use as the default redactor for telemetry adapters.
 *
 * When not to use:
 * - Do not disable unless you have a secure private telemetry pipeline.
 *
 * Parameters:
 * - `input`: Headers/body object to redact. Nullable: no.
 *
 * Return semantics:
 * - Returns a new object with redacted headers and no body.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Token-like headers are redacted by key name matching.
 *
 * Data/auth references:
 * - Removes Authorization, Cookie, and token-bearing headers.
 */
export function defaultRedact(input) {
    const h = input.headers ? { ...input.headers } : undefined;
    if (h) {
        for (const k of Object.keys(h)) {
            const key = k.toLowerCase();
            if (key === "authorization" || key === "cookie" || key === "set-cookie") {
                delete h[k];
            }
            else if (key.includes("token")) {
                h[k] = "[redacted]";
            }
        }
    }
    // We avoid attempting to deeply redact bodies (could be large/unknown).
    // Consumers can provide a custom redact function if desired.
    return { headers: h, body: undefined };
}
