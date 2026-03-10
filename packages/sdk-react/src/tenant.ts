import { useCallback, useEffect, useState } from "react";
import { AccountService, type AccountState, type BootstrapPayload } from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { subscribeResourceUpdate } from "./resources.js";

const EMPTY_NETWORKS: NonNullable<BootstrapPayload["networks"]> = [];
const EMPTY_TOKENS: NonNullable<BootstrapPayload["tokens"]> = [];
const EMPTY_TRANSFER_PROVIDERS: any[] = [];

/**
 * Return tenant configuration and bootstrap data from SDK state.
 *
 * @remarks
 * Purpose:
 * - Provide tenant metadata, networks, tokens, and transfer providers for UI.
 *
 * When to use:
 * - Use in components that need tenant branding or network configuration.
 *
 * When not to use:
 * - Do not use as a substitute for server-side tenant configuration checks.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ tenant, networks, tokens, branding, version, transferProviders, isLoading, error }`.
 *
 * Errors/failure modes:
 * - None; errors are surfaced from SDK auth state.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networks`, `tokens`, and `transferProviders` are arrays with stable empty fallbacks.
 *
 * Data/auth references:
 * - Derived from OAuth bootstrap (`/oauth/tenant`) and auth state.
 */
export const useTenantConfig = () => {
  const { state, bootstrap } = useSDK();
  const transferProviders =
    // bootstrap (camel + snake)
    (bootstrap?.tenant as any)?.transferProviders ??
    (bootstrap?.tenant as any)?.transfer_providers ??
    (bootstrap as any)?.transferProviders ??
    (bootstrap as any)?.transfer_providers ??
    // state (camel + snake)
    state.tenant?.transferProviders ??
    (state.tenant as any)?.transfer_providers ??
    EMPTY_TRANSFER_PROVIDERS;
  return {
    tenant: state.tenant,
    networks: bootstrap?.networks ?? state.tenant?.networks ?? EMPTY_NETWORKS,
    tokens: bootstrap?.tokens ?? state.tenant?.tokens ?? EMPTY_TOKENS,
    branding: undefined,
    version: state.tenant?.version,
    transferProviders,
    isLoading: state.status === "loading",
    error: state.error
  };
};

/**
 * Reload tenant bootstrap data for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - Provide a manual refresh hook for tenant config and bootstrap state.
 *
 * When to use:
 * - Use after tenant settings change (branding, networks, tokens) or after profile edits
 *   that need a fresh bootstrap snapshot.
 *
 * When not to use:
 * - Do not use when unauthenticated; `reload` throws if no active session exists.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ reload, isLoading, error }`.
 * - `reload` resolves to the latest BootstrapPayload.
 *
 * Errors/failure modes:
 * - `reload` throws when unauthenticated or when bootstrap refresh fails.
 * - `error` captures the most recent reload failure.
 *
 * Side effects:
 * - Fetches OAuth bootstrap data and updates SDK provider state.
 *
 * Invariants/assumptions:
 * - Requires an authenticated session with a valid access token.
 *
 * Data/auth references:
 * - Uses OAuth bootstrap endpoints via `oauth.fetchBootstrap`.
 *
 * @example
 * const { reload } = useTenantReload();
 */
export const useTenantReload = () => {
  const { state, reloadBootstrap } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async (): Promise<BootstrapPayload> => {
    if (state.status !== "authenticated") {
      throw new Error("User is not authenticated");
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = await reloadBootstrap();
      if (!payload) {
        throw new Error("Failed to reload tenant configuration");
      }
      return payload;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to reload tenant configuration");
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [reloadBootstrap, state.status]);

  return { reload, isLoading, error };
};

/**
 * Fetch the authenticated account state (primary account).
 *
 * @remarks
 * Purpose:
 * - Provide account state with a refresh helper.
 * - Use bootstrap state when available for fast reads.
 *
 * When to use:
 * - Use when you need account state in React components.
 *
 * When not to use:
 * - Do not use when unauthenticated; `refresh` will throw.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ accountState, account, isLoading, error, refresh }`.
 * - `account` is null when unauthenticated.
 *
 * Errors/failure modes:
 * - `refresh` throws when the account endpoint is unavailable or unauthorized.
 *
 * Side effects:
 * - `refresh` performs OAuth requests and updates local state.
 * - Subscribes to `account` invalidations.
 *
 * Invariants/assumptions:
 * - `refresh` requires `account:read` scope.
 *
 * Data/auth references:
 * - `/account` (oauth-server, bearer token).
 * - Uses bootstrap data from `/oauth/user` when present.
 *
 * @example
 * const { account, refresh } = useAccountState();
 *
 * @see /account
 * @see /oauth/user
 */
export const useAccountState = () => {
  const { state, authClient, iee } = useSDK();
  const [accountState, setAccountState] = useState<AccountState | null>(
    state.accountState ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (state.accountState) {
      setAccountState(state.accountState);
      return;
    }
    if (state.user) {
      setAccountState({ account: state.user.account });
      return;
    }
    setAccountState(null);
  }, [state.accountState, state.user]);

  const refresh = useCallback(async (): Promise<AccountState> => {
    if (state.status !== "authenticated") {
      throw new Error("User is not authenticated");
    }
    setIsLoading(true);
    setError(null);
    try {
      const service = new AccountService({ client: authClient, iee });
      const data = await service.getAccountState();
      setAccountState(data);
      return data;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to load account state");
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [authClient, iee, state.status]);

  useEffect(() => {
    return subscribeResourceUpdate("account", () => {
      if (state.status !== "authenticated") return;
      void refresh().catch(() => {
        // Best-effort refresh; ignore background errors.
      });
    });
  }, [refresh, state.status]);

  return {
    accountState,
    account: accountState?.account?.account ?? null,
    isLoading,
    error,
    refresh,
  };
};
