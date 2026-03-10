import { useCallback, useEffect, useRef, useState } from 'react';
import { issueInstallationToken } from '@xkova/sdk-core';
/**
 * Issue and auto-refresh an installation token for a service installation.
 *
 * @remarks
 * Purpose:
 * - Calls the SDK core issuance endpoint and schedules refresh before expiry.
 *
 * When to use:
 * - Use in trusted React clients that need a short-lived installation token.
 *
 * When not to use:
 * - Do not use in server components or any environment where credentials are not secured.
 *
 * Parameters:
 * - `params.baseUrl`: OAuth server base URL. Format: https://host. Nullable: no.
 * - `params.serviceId`: Service identifier. Nullable: no.
 * - `params.installationId`: Installation identifier. Nullable: no.
 * - `params.serviceCredential`: Credential used to mint the token. Nullable: no.
 *
 * Return semantics:
 * - Returns `{ token, expiresAt, loading, error, refresh }` for rendering and manual refresh.
 *
 * Errors/failure modes:
 * - Network or auth failures set `error` and clear `token`.
 *
 * Side effects:
 * - Schedules a timer to refresh the token prior to expiry.
 *
 * Invariants/assumptions:
 * - Refresh attempts occur at least 30 seconds before expiry when possible.
 *
 * Data/auth references:
 * - Uses {@link issueInstallationToken} under the hood; credentials and tokens are sensitive.
 *
 * Security notes:
 * - Keep `serviceCredential` out of logs and client storage whenever possible.
 *
 * Runtime constraints:
 * - Client-only; relies on React state/effects and timers.
 */
export function useInstallationToken(params) {
    const { baseUrl, serviceId, installationId, serviceCredential } = params;
    const [token, setToken] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const refreshRef = useRef(null);
    const clearRefresh = () => {
        if (refreshRef.current) {
            clearTimeout(refreshRef.current);
            refreshRef.current = null;
        }
    };
    const scheduleRefresh = (expiresInSeconds) => {
        clearRefresh();
        const refreshMs = Math.max((expiresInSeconds - 30) * 1000, 30000); // refresh 30s before expiry, min 30s
        refreshRef.current = setTimeout(() => {
            void fetchToken();
        }, refreshMs);
    };
    const fetchToken = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await issueInstallationToken({
                baseUrl,
                serviceId,
                installationId,
                serviceCredential,
            });
            setToken(result.token);
            const now = Date.now();
            const exp = now + result.expiresIn * 1000;
            setExpiresAt(exp);
            scheduleRefresh(result.expiresIn);
        }
        catch (err) {
            setError(err?.message || 'Failed to issue installation token');
            setToken(null);
            clearRefresh();
        }
        finally {
            setLoading(false);
        }
    }, [baseUrl, installationId, serviceCredential, serviceId]);
    useEffect(() => {
        void fetchToken();
        return () => clearRefresh();
    }, [fetchToken]);
    return { token, expiresAt, loading, error, refresh: fetchToken };
}
