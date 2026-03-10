import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MarketplaceCatalogService,
  AgentActionsService,
  TransactionHistoryService,
  type MarketplaceAgent,
  type AgentInstallationDetails,
  type AgentInstallationFailureBreakdown,
  type PrepareInstallationRequest,
  type PrepareInstallationResponse,
  type ConfirmInstallationRequest,
  type ConfirmInstallationResponse,
  type UpdateInstallationConfigOptions,
} from '@xkova/sdk-core';
import { useSDK } from './provider.js';
import {
  emitResourceUpdate,
  markSDKResourceFetched,
  subscribeResourceUpdate,
  useSDKResourceFreshness,
} from './resources.js';
import { resolvePollingFallbackMs } from './realtime.js';
import { useTransactionHistory } from './transactions.js';
export { useInstallationToken } from './agents/useInstallationToken.js';

/**
 * @deprecated Use `useMyAgentInstallations` and `useMarketplaceAgents` instead.
 *
 * @remarks
 * Purpose:
 * - Provide a legacy wrapper for agent catalog and installations.
 *
 * Legacy bootstrap-based metadata has been removed from OAuth responses.
 *
 * When to use:
 * - Do not use; this hook is deprecated.
 *
 * When not to use:
 * - Use useMyAgentInstallations/useMarketplaceAgents for current data.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ agents, installations }`.
 *
 * Errors/failure modes:
 * - Delegates to underlying hooks; see their `error` fields.
 *
 * Side effects:
 * - Triggers network fetches via underlying hooks.
 *
 * Invariants/assumptions:
 * - `agents` and `installations` are always arrays.
 *
 * Data/auth references:
 * - `/marketplace/tenant/catalog` via useMarketplaceAgents.
 * - `/agents` and `/transactions/installations/failures/counts` via useMyAgentInstallations.
 *
 * @see useMarketplaceAgents
 * @see useMyAgentInstallations
 */
export const useAgentInstallations = () => {
  const catalog = useMarketplaceAgents();
  const installs = useMyAgentInstallations();
  return { agents: catalog.agents, installations: installs.installations };
};

/**
 * Agent transaction history hook.
 *
 * @remarks
 * Purpose:
 * - Filter `/transactions/history` to `category=agent`.
 *
 * When to use:
 * - Use when showing agent-only transaction activity.
 *
 * When not to use:
 * - Do not use for general payments or transfers; use useTransactionHistory or useTransferTransactions.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns agent transaction list and fetch helpers.
 *
 * Errors/failure modes:
 * - Surfaces API errors from transaction history via `error`.
 *
 * Side effects:
 * - Issues history fetches when authenticated.
 *
 * Invariants/assumptions:
 * - `transactions` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` with `category=agent` (apps/api, bearer token).
 *
 * @example
 * const { transactions } = useAgentTransactions();
 *
 * @see useTransactionHistory
 */
export const useAgentTransactions = () => {
  const history = useTransactionHistory({ category: 'agent' });
  return {
    transactions: history.transactions,
    isLoading: history.isLoading,
    error: history.error,
    refetch: history.refetch,
  };
};

/**
 * Aggregate agent installation and transaction helpers.
 *
 * @remarks
 * Purpose:
 * - Combine agent installation and transaction hooks into a single object.
 *
 * When to use:
 * - Use when a screen needs both agent catalog/installations and agent transactions.
 *
 * When not to use:
 * - Do not use when you only need one of the underlying hooks.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns a merged object from useAgentInstallations and useAgentTransactions.
 *
 * Errors/failure modes:
 * - Propagates errors from the underlying hooks.
 *
 * Side effects:
 * - Triggers the underlying hook fetches.
 *
 * Invariants/assumptions:
 * - Returned object includes `agents`, `installations`, and `transactions` fields.
 *
 * Data/auth references:
 * - Uses OAuth agent endpoints and apps/api transaction history.
 */
export const useAgentInstallationsAndTransactions = () => {
  const installs = useAgentInstallations();
  const tx = useAgentTransactions();
  return { ...installs, ...tx };
};

// =============================================================================
// NEW: Marketplace & Agent Installation Hooks (API-backed)
// =============================================================================

/**
 * Fetch marketplace agents enabled for the current tenant (curated set).
 *
 * @remarks
 * Purpose:
 * - Load the tenant-scoped marketplace catalog for end users.
 *
 * When to use:
 * - Use when displaying a marketplace catalog in the UI.
 *
 * When not to use:
 * - Do not use for global agent discovery; this is tenant-scoped.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ agents, isLoading, error, refresh }`.
 *
 * Errors/failure modes:
 * - Sets `error` when the OAuth request fails.
 *
 * Side effects:
 * - Issues OAuth requests to load the catalog.
 *
 * Invariants/assumptions:
 * - `agents` is always an array.
 *
 * Data/auth references:
 * - OAuth marketplace catalog endpoints.
 */
export const useMarketplaceAgents = () => {
  const { state, authClient, iee } = useSDK();
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (state.status !== 'authenticated') {
      setAgents([]);
      return;
    }

    let cancelled = false;
    const service = new MarketplaceCatalogService({ client: authClient, iee });

    const load = async () => {
      setIsLoading(true);
      try {
        // NOTE: SDK `MarketplaceCatalogService.listAgents()` is tenant-scoped (curated) in this repo.
        const data = await service.listAgents();
        if (cancelled) return;
        setAgents(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [state.status, authClient, iee, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { agents, isLoading, error, refresh };
};

/**
 * Fetches user's agent installations from the API (not bootstrap metadata).
 *
 * @remarks
 * Purpose:
 * - List the authenticated user's agent installations and failure counts.
 * - Automatically refetches when the SDK invalidates the `agent-installations` resource.
 * - Acts as the canonical app-consumption surface for agent installation freshness.
 *
 * When to use:
 * - Use when you need live agent installation status and failure counts.
 *
 * When not to use:
 * - Do not use when unauthenticated or when agent features are disabled.
 *
 * Parameters:
 * - `options`: Optional refresh configuration. Nullable: yes.
 * - `options.autoRefreshMs`: Auto-refresh interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 *
 * Return semantics:
 * - Returns installations, loading/error state, refresh helper, failure counts, and failure breakdowns.
 *
 * Errors/failure modes:
 * - Sets `error` when the API request fails or is unauthorized.
 *
 * Side effects:
 * - Issues API calls to OAuth and apps/api when authenticated.
 * - Subscribes to SDK resource invalidations for `agent-installations`.
 *
 * Invariants/assumptions:
 * - `installations` is always an array.
 * - Realtime transport handling is owned by `XKOVAProvider`; this hook only consumes
 *   SDK resource invalidations and optional polling fallback.
 * - Consumer apps should not implement bespoke websocket logic for installation refresh.
 *
 * Data/auth references:
 * - OAuth agent installation endpoints and transaction history counts.
 *
 * @example
 * const { installations, refresh } = useMyAgentInstallations();
 */
export const useMyAgentInstallations = (options?: {
  autoRefreshMs?: number;
}) => {
  const { state, authClient, apiClient, iee, realtime } = useSDK();
  const freshness = useSDKResourceFreshness('agent-installations');
  const autoRefreshMs = resolvePollingFallbackMs(options?.autoRefreshMs, realtime);
  const [installations, setInstallations] = useState<
    AgentInstallationDetails[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [failureCounts, setFailureCounts] = useState<Record<string, number>>(
    {},
  );
  const [failureBreakdowns, setFailureBreakdowns] = useState<
    Record<string, AgentInstallationFailureBreakdown>
  >({});
  const [failuresLoading, setFailuresLoading] = useState(false);

  const load = useCallback(async () => {
    if (state.status !== 'authenticated') {
      setInstallations([]);
      setFailureCounts({});
      setFailureBreakdowns({});
      return;
    }

    let cancelled = false;
    const service = new AgentActionsService({ client: authClient, iee });
    const txService = new TransactionHistoryService({ client: apiClient, iee });

    setIsLoading(true);
    try {
      const data = await service.listInstallations();
      if (cancelled) return;
      setInstallations(data);
      setError(null);
      markSDKResourceFetched('agent-installations');

      // Best-effort: fetch failure counts for all installations in one call.
      // If this fails, we leave failureCounts empty (UI should handle missing as 0/unknown).
      const ids = (data ?? []).map((i) => i.installationId).filter(Boolean);
      if (ids.length > 0) {
        setFailuresLoading(true);
        try {
          const res = await txService.getInstallationFailureCounts(ids);
          if (!cancelled) {
            setFailureCounts(res?.counts ?? {});
            setFailureBreakdowns(res?.breakdowns ?? {});
          }
        } finally {
          if (!cancelled) setFailuresLoading(false);
        }
      } else {
        setFailureCounts({});
        setFailureBreakdowns({});
      }
    } catch (err) {
      if (cancelled) return;
      setError(err as Error);
    } finally {
      if (!cancelled) setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [state.status, authClient, apiClient, iee]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!autoRefreshMs || state.status !== 'authenticated') return;
    const interval = setInterval(() => {
      load();
    }, autoRefreshMs);
    return () => clearInterval(interval);
  }, [autoRefreshMs, load, state.status]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    return subscribeResourceUpdate('agent-installations', () => {
      refresh();
    });
  }, [refresh]);

  return {
    installations,
    isLoading,
    error,
    refresh,
    failureCounts,
    failureBreakdowns,
    failuresLoading,
    freshness,
  };
};

/**
 * Agent installation action helpers.
 *
 * @remarks
 * Purpose:
 * - Provide install/uninstall/budget actions for agent installations.
 * - Supports retrying provisioning webhooks when delivery fails.
 *
 * When to use:
 * - Use when managing agent installations in the UI.
 *
 * When not to use:
 * - Do not use when unauthenticated or when agent features are disabled.
 *
 * - Delegates to OAuth agent endpoints with canonical fields.
 * - Receipt-gated actions require IEE (SafeApprove) receipts (install, uninstall, budget changes, resume/retry, pause).
 *
 * Parameters:
 * - None. Hook-only; call returned helpers to execute actions.
 *
 * Return semantics:
 * - Returns action helpers with loading/error state.
 *
 * Errors/failure modes:
 * - Throws when unauthenticated or when OAuth requests fail.
 *
 * Side effects:
 * - Issues OAuth requests, may trigger on-chain workflows, and invalidates the `agent-installations` resource.
 * - Successful local mutations emit `agent-installations` invalidation so installation hooks refresh.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK session.
 * - Async lifecycle updates that happen outside the initiating client (for example webhook/cron
 *   transitions) are expected to arrive through server-triggered SDK resource invalidation.
 *
 * Data/auth references:
 * - OAuth agent endpoints for installs and budget management.
 *
 * @example
 * const { prepareInstallation } = useAgentInstallationActions();
 */
export const useAgentInstallationActions = () => {
  const { state, authClient, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => {
    return new AgentActionsService({ client: authClient, iee });
  }, [authClient, iee]);

  const prepareInstallation = useCallback(
    async (
      request: PrepareInstallationRequest,
    ): Promise<PrepareInstallationResponse> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.prepareInstallation(request);
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to prepare installation');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const confirmInstallation = useCallback(
    async (
      request: ConfirmInstallationRequest,
    ): Promise<ConfirmInstallationResponse> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.confirmInstallation(request);
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to confirm installation');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const updateInstallationConfig = useCallback(
    async (
      installationId: string,
      installInputs: Record<string, string | number>,
      options?: UpdateInstallationConfigOptions,
    ) => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.updateInstallationConfig(
          installationId,
          installInputs,
          options,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to update installation config');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const uninstallAgent = useCallback(
    async (agentActorId: string, receipt?: string | null) => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.uninstallAgent(agentActorId, receipt);
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error ? err : new Error('Failed to uninstall agent');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const confirmRevocation = useCallback(
    async (
      installationId: string,
      transactionHash: string,
      receipt?: string | null,
    ): Promise<{ status: 'revoked' }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.confirmRevocation(
          installationId,
          transactionHash,
          receipt,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to confirm revocation');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const increaseBudget = useCallback(
    async (
      installationId: string,
      additionalBudget: string,
      receipt?: string | null,
    ): Promise<{ updated: boolean; newBudget: string }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.increaseBudget(
          installationId,
          additionalBudget,
          receipt,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error ? err : new Error('Failed to increase budget');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const prepareIncreaseBudget = useCallback(
    async (
      installationId: string,
      additionalBudget: string,
      receipt?: string | null,
    ): Promise<{
      preparationToken: string;
      installationId: string;
      agentPass: string;
      account: string;
      unsignedTransaction: unknown;
      thirdwebClientId: string;
      expiresAt: string;
      newBudget: string;
    }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        return await service.prepareIncreaseBudget(
          installationId,
          additionalBudget,
          receipt,
        );
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to prepare budget increase');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const confirmIncreaseBudget = useCallback(
    async (
      installationId: string,
      preparationToken: string,
      transactionHash: string,
      receiptOrOptions?:
        | string
        | {
            receipt?: string | null;
            additionalBudget?: string | null;
            tokenBudgetsByTokenPoolId?: Record<string, string> | null;
            tokenBudgetMode?: 'single' | 'all' | null;
          },
    ): Promise<{ updated: boolean; newBudget: string }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.confirmIncreaseBudget(
          installationId,
          preparationToken,
          transactionHash,
          receiptOrOptions,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to confirm budget increase');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const prepareDecreaseBudget = useCallback(
    async (
      installationId: string,
      decreaseAmount: string,
      receipt?: string | null,
    ): Promise<{
      preparationToken: string;
      installationId: string;
      agentPass: string;
      account: string;
      unsignedTransaction: unknown;
      thirdwebClientId: string;
      expiresAt: string;
      newBudget: string;
    }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        return await service.prepareDecreaseBudget(
          installationId,
          decreaseAmount,
          receipt,
        );
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to prepare budget decrease');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const confirmDecreaseBudget = useCallback(
    async (
      installationId: string,
      preparationToken: string,
      transactionHash: string,
      receiptOrOptions?:
        | string
        | {
            receipt?: string | null;
            decreaseAmount?: string | null;
            tokenBudgetsByTokenPoolId?: Record<string, string> | null;
            tokenBudgetMode?: 'single' | 'all' | null;
          },
    ): Promise<{ updated: boolean; newBudget: string }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.confirmDecreaseBudget(
          installationId,
          preparationToken,
          transactionHash,
          receiptOrOptions,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to confirm budget decrease');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const resumeInstallation = useCallback(
    async (
      installationId: string,
      receipt?: string | null,
    ): Promise<{ status: string }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.resumeInstallation(
          installationId,
          receipt,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to resume installation');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const pauseInstallation = useCallback(
    async (
      installationId: string,
      reason?: string,
      options?: { receipt?: string | null },
    ): Promise<{ status: string; pauseCode: string | null }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.pauseInstallation(
          installationId,
          reason,
          options,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to pause installation');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  const getInstallationStatus = useCallback(
    async (
      installationId: string,
    ): Promise<{
      status: string;
      message: string;
      canRetry: boolean;
      installationId: string;
      createdAt: string;
    }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      return service.getInstallationStatus(installationId);
    },
    [state.status, service],
  );

  const retryProvisioningWebhook = useCallback(
    async (
      installationId: string,
      receipt?: string | null,
    ): Promise<{ success: boolean; message: string }> => {
      if (state.status !== 'authenticated') {
        throw new Error('User is not authenticated');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.retryProvisioningWebhook(
          installationId,
          receipt,
        );
        emitResourceUpdate('agent-installations');
        return result;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to retry provisioning webhook');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [state.status, service],
  );

  return {
    prepareInstallation,
    confirmInstallation,
    updateInstallationConfig,
    uninstallAgent,
    confirmRevocation,
    increaseBudget,
    prepareIncreaseBudget,
    confirmIncreaseBudget,
    prepareDecreaseBudget,
    confirmDecreaseBudget,
    resumeInstallation,
    pauseInstallation,
    getInstallationStatus,
    retryProvisioningWebhook,
    isLoading,
    error,
  };
};
