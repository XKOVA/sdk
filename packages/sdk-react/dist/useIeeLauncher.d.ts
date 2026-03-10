import { type LaunchIeeParams, type LaunchIeeResult } from "@xkova/sdk-browser";
export type IeeLauncherStatus = "idle" | "pending" | "approved" | "cancelled" | "error";
export interface IeeLauncherState {
    status: IeeLauncherStatus;
    result?: LaunchIeeResult;
    error?: {
        code: string;
        message: string;
    };
}
/**
 * React hook wrapper around the IEE (SafeApprove) launcher.
 *
 * @remarks
 * Purpose:
 * - Launch the oauth-server IEE (SafeApprove) iframe with strict origin + receipt_request_id binding.
 *
 * When to use:
 * - Use when you need a React-friendly launcher that tracks pending/approved/cancelled/error states.
 *
 * When not to use:
 * - Do not use on the server; this hook requires a browser environment.
 *
 * Return semantics:
 * - Returns `state`, a `launch` function, and `reset`.
 * - `launch` resolves with the same shape as `launchIee`.
 *
 * Errors/failure modes:
 * - Propagates errors via `state.error` and the resolved result when the iframe fails, is aborted, or times out.
 *
 * Side effects:
 * - Overlays an iframe on the current document.
 *
 * Invariants/assumptions:
 * - `expectedIeeOrigin` and `returnOrigin` must be exact origins (no wildcards).
 */
export declare function useIeeLauncher(defaultParams?: Partial<LaunchIeeParams>): {
    state: IeeLauncherState;
    launch: (params: LaunchIeeParams) => Promise<{
        status: "approved";
        receipt: string;
        actionType?: string;
        actionHash?: string;
        jti?: string;
        receiptExpiresAt?: number;
        contextHash?: string | null;
        txIntent?: any;
        userOpHash?: string | null;
        transactionHash?: string | null;
        preparationToken?: string | null;
        installationId?: string | null;
        resolvedPayload?: Record<string, unknown> | null;
    } | {
        status: "cancelled";
    } | {
        status: "error";
        error: {
            code: string;
            message: string;
        };
    }>;
    reset: () => void;
};
