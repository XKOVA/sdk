import { type MarketplaceAgent, type AgentInstallationDetails, type AgentInstallationFailureBreakdown, type PrepareInstallationRequest, type PrepareInstallationResponse, type ConfirmInstallationRequest, type ConfirmInstallationResponse, type UpdateInstallationConfigOptions } from '@xkova/sdk-core';
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
export declare const useAgentInstallations: () => {
    agents: MarketplaceAgent[];
    installations: AgentInstallationDetails[];
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
export declare const useAgentTransactions: () => {
    transactions: import("@xkova/sdk-core").TransactionHistoryItem[] & import("@xkova/sdk-core").TransactionHistoryDisplayItem[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
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
export declare const useAgentInstallationsAndTransactions: () => {
    transactions: import("@xkova/sdk-core").TransactionHistoryItem[] & import("@xkova/sdk-core").TransactionHistoryDisplayItem[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    agents: MarketplaceAgent[];
    installations: AgentInstallationDetails[];
};
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
export declare const useMarketplaceAgents: () => {
    agents: MarketplaceAgent[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => void;
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
export declare const useMyAgentInstallations: (options?: {
    autoRefreshMs?: number;
}) => {
    installations: AgentInstallationDetails[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => void;
    failureCounts: Record<string, number>;
    failureBreakdowns: Record<string, AgentInstallationFailureBreakdown>;
    failuresLoading: boolean;
    freshness: import("./resources.js").SDKResourceFreshness;
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
export declare const useAgentInstallationActions: () => {
    prepareInstallation: (request: PrepareInstallationRequest) => Promise<PrepareInstallationResponse>;
    confirmInstallation: (request: ConfirmInstallationRequest) => Promise<ConfirmInstallationResponse>;
    updateInstallationConfig: (installationId: string, installInputs: Record<string, string | number>, options?: UpdateInstallationConfigOptions) => Promise<{
        installationId: string;
        installInputs: Record<string, string>;
        installQuestionsVersion: number | null;
        updatedAt: string;
    }>;
    uninstallAgent: (agentActorId: string, receipt?: string | null) => Promise<import("@xkova/sdk-core").UninstallAgentResult>;
    confirmRevocation: (installationId: string, transactionHash: string, receipt?: string | null) => Promise<{
        status: "revoked";
    }>;
    increaseBudget: (installationId: string, additionalBudget: string, receipt?: string | null) => Promise<{
        updated: boolean;
        newBudget: string;
    }>;
    prepareIncreaseBudget: (installationId: string, additionalBudget: string, receipt?: string | null) => Promise<{
        preparationToken: string;
        installationId: string;
        agentPass: string;
        account: string;
        unsignedTransaction: unknown;
        thirdwebClientId: string;
        expiresAt: string;
        newBudget: string;
    }>;
    confirmIncreaseBudget: (installationId: string, preparationToken: string, transactionHash: string, receiptOrOptions?: string | {
        receipt?: string | null;
        additionalBudget?: string | null;
        tokenBudgetsByTokenPoolId?: Record<string, string> | null;
        tokenBudgetMode?: "single" | "all" | null;
    }) => Promise<{
        updated: boolean;
        newBudget: string;
    }>;
    prepareDecreaseBudget: (installationId: string, decreaseAmount: string, receipt?: string | null) => Promise<{
        preparationToken: string;
        installationId: string;
        agentPass: string;
        account: string;
        unsignedTransaction: unknown;
        thirdwebClientId: string;
        expiresAt: string;
        newBudget: string;
    }>;
    confirmDecreaseBudget: (installationId: string, preparationToken: string, transactionHash: string, receiptOrOptions?: string | {
        receipt?: string | null;
        decreaseAmount?: string | null;
        tokenBudgetsByTokenPoolId?: Record<string, string> | null;
        tokenBudgetMode?: "single" | "all" | null;
    }) => Promise<{
        updated: boolean;
        newBudget: string;
    }>;
    resumeInstallation: (installationId: string, receipt?: string | null) => Promise<{
        status: string;
    }>;
    pauseInstallation: (installationId: string, reason?: string, options?: {
        receipt?: string | null;
    }) => Promise<{
        status: string;
        pauseCode: string | null;
    }>;
    getInstallationStatus: (installationId: string) => Promise<{
        status: string;
        message: string;
        canRetry: boolean;
        installationId: string;
        createdAt: string;
    }>;
    retryProvisioningWebhook: (installationId: string, receipt?: string | null) => Promise<{
        success: boolean;
        message: string;
    }>;
    isLoading: boolean;
    error: Error | null;
};
