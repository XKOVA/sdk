const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function isAbortLike(err) {
    if (!err || typeof err !== "object")
        return false;
    const e = err;
    return e?.name === "AbortError";
}
function shouldRetryStatusDefault(status) {
    return status === 408 || status === 429 || status >= 500;
}
function computeBackoffMs(attempt, opts) {
    // Exponential backoff with jitter.
    const exp = opts.backoffMs * Math.pow(2, attempt);
    const capped = Math.min(opts.maxBackoffMs, exp);
    // Full jitter: random in [0, capped]
    return Math.floor(Math.random() * capped);
}
function parseRetryAfter(value) {
    if (!value)
        return null;
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
function createAbortError(message) {
    // DOMException may not exist in all runtimes (node).
    try {
        // eslint-disable-next-line no-undef
        return new DOMException(message, "AbortError");
    }
    catch {
        const err = new Error(message);
        err.name = "AbortError";
        return err;
    }
}
function createTimeoutSignal(parent, timeoutMs) {
    if (!timeoutMs || timeoutMs <= 0) {
        return { signal: parent, cleanup: () => { } };
    }
    const controller = new AbortController();
    const onAbort = () => {
        try {
            controller.abort();
        }
        catch {
            /* ignore */
        }
    };
    if (parent) {
        if (parent.aborted) {
            onAbort();
            return { signal: controller.signal, cleanup: () => { } };
        }
        if (typeof parent.addEventListener === "function") {
            parent.addEventListener("abort", onAbort, { once: true });
        }
    }
    const t = setTimeout(() => {
        try {
            controller.abort();
        }
        catch {
            /* ignore */
        }
    }, timeoutMs);
    const cleanup = () => {
        clearTimeout(t);
        if (parent && typeof parent.removeEventListener === "function") {
            parent.removeEventListener("abort", onAbort);
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
export async function fetchWithPolicy(fetchFn, url, init, policy) {
    // Industry-standard approach: a total timeout budget + per-attempt timeout.
    // Defaults: 30s total, 10s per attempt.
    const totalTimeoutMs = policy?.timeoutMs ?? 30000;
    const attemptTimeoutMs = policy?.attemptTimeoutMs ?? 10000;
    const deadline = totalTimeoutMs > 0 ? Date.now() + totalTimeoutMs : null;
    const retry = policy?.retry ?? {};
    const retries = retry.retries ?? 2;
    const backoffMs = retry.backoffMs ?? 300;
    const maxBackoffMs = retry.maxBackoffMs ?? 3000;
    const retryOnStatus = retry.retryOnStatus ?? shouldRetryStatusDefault;
    const respectRetryAfter = retry.respectRetryAfter === true;
    const retryMethods = (retry.methods ?? ["GET", "HEAD", "OPTIONS"]).map((m) => m.toUpperCase());
    const method = (init?.method ?? "GET").toUpperCase();
    const isRetryableMethod = retryMethods.includes(method) || policy?.allowRetryForNonIdempotent === true;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        policy?.hooks?.onAttemptStart?.({ url, method, attempt, maxRetries: retries });
        const remainingTotal = deadline == null ? null : Math.max(0, deadline - Date.now());
        if (remainingTotal != null && remainingTotal <= 0) {
            const err = createAbortError("Request timed out");
            policy?.hooks?.onAttemptEnd?.({ url, method, attempt, error: err });
            throw err;
        }
        const effectiveAttemptTimeout = remainingTotal == null
            ? attemptTimeoutMs
            : Math.min(attemptTimeoutMs, remainingTotal);
        const { signal, cleanup } = createTimeoutSignal(init?.signal ?? undefined, effectiveAttemptTimeout);
        try {
            const res = await fetchFn(url, { ...init, signal });
            cleanup();
            if (res.ok)
                return res;
            if (isRetryableMethod && attempt < retries && retryOnStatus(res.status)) {
                try {
                    // Avoid leaking open streams on retry.
                    res.body?.cancel?.();
                }
                catch {
                    /* ignore */
                }
                const retryAfterMs = respectRetryAfter
                    ? parseRetryAfter(res.headers.get("retry-after"))
                    : null;
                const wait = retryAfterMs != null
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
        }
        catch (err) {
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
