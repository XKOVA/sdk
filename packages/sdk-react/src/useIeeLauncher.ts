import { useCallback, useMemo, useState } from "react";
import {
  launchIee,
  type LaunchIeeParams,
  type LaunchIeeResult,
} from "@xkova/sdk-browser";

export type IeeLauncherStatus = "idle" | "pending" | "approved" | "cancelled" | "error";

export interface IeeLauncherState {
  status: IeeLauncherStatus;
  result?: LaunchIeeResult;
  error?: { code: string; message: string };
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
export function useIeeLauncher(defaultParams?: Partial<LaunchIeeParams>) {
  const [state, setState] = useState<IeeLauncherState>({ status: "idle" });

  const launch = useCallback(
    async (params: LaunchIeeParams) => {
      setState({ status: "pending" });
      try {
        const result = await launchIee({
          ...defaultParams,
          ...params,
        });

        if (result.status === "error") {
          setState({ status: "error", result, error: result.error });
          return result;
        }

        setState({ status: result.status, result });
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to launch the SafeApprove approval window.";
        const result: LaunchIeeResult = {
          status: "error",
          error: { code: "IEE_LAUNCH_FAILED", message },
        };
        setState({ status: "error", result, error: result.error });
        return result;
      }
    },
    [defaultParams],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return useMemo(() => ({ state, launch, reset }), [state, launch, reset]);
}
