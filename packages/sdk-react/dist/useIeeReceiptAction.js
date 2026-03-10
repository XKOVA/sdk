import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { IeeError, IeeService, prepareIeeActionPayload } from "@xkova/sdk-core";
import { useIeeLauncher } from "./useIeeLauncher.js";
import { normalizeTenantAuthBaseUrl } from "./shared.js";
import { useIeeContext, useSDK } from "./provider.js";
import { useTenantConfig } from "./tenant.js";
/**
 * Helper hook to issue an IEE (SafeApprove) prep ticket, launch the oauth-server IEE (SafeApprove) UI, and return the receipt.
 *
 * @remarks
 * Purpose:
 * - Encapsulates prep ticket issuance and IEE (SafeApprove) launcher wiring for receipt-gated actions.
 * - Uses the tenant auth domain for the IEE (SafeApprove) UI when available (falls back to OAuth baseUrl).
 *
 * When to use:
 * - Use before calling receipt-gated commit endpoints (e.g., payments/agents) to obtain the IEE (SafeApprove) receipt.
 *
 * When not to use:
 * - Do not use on the server; browser-only (uses window + postMessage).
 *
 * Errors/failure modes:
 * - Returns `{ status: "error", error }` on ticket issuance or IEE (SafeApprove) launch failures.
 * - Returns `{ status: "error", error: { code: "THIRD_PARTY_ACTION_UNSUPPORTED" } }` for unsupported actions.
 *
 * Side effects:
 * - Opens the iframe modal to the oauth-server `/iee` route.
 */
export function useIeeReceiptAction(params = {}) {
    const { authClient, oauth } = useSDK();
    const { tenantId, clientId, userId } = useIeeContext();
    const { tenant } = useTenantConfig();
    const [state, setState] = useState({ status: "idle" });
    const launcher = useIeeLauncher();
    const tenantAuthDomain = tenant?.authDomain ?? tenant?.auth_domain ?? null;
    const ieeBaseUrl = useMemo(() => {
        const tenantAuthBase = normalizeTenantAuthBaseUrl(tenantAuthDomain);
        if (tenantAuthBase) {
            try {
                return new URL(tenantAuthBase).origin;
            }
            catch {
                // Fall back to OAuth baseUrl when tenant auth domain is invalid.
            }
        }
        return oauth.getBaseUrl();
    }, [oauth, tenantAuthDomain]);
    const ieeUrl = useMemo(() => {
        const base = ieeBaseUrl.replace(/\/+$/, "");
        return `${base}${params.ieePath ?? "/iee"}`;
    }, [ieeBaseUrl, params.ieePath]);
    const expectedIeeOrigin = useMemo(() => {
        try {
            return new URL(ieeUrl).origin;
        }
        catch {
            return "";
        }
    }, [ieeUrl]);
    const run = useCallback(async (options) => {
        const receiptRequestId = options.receiptRequestId ?? uuidv4();
        setState({ status: "pending" });
        try {
            const resolved = prepareIeeActionPayload({
                actionType: options.actionType,
                payload: options.payload,
                context: { tenantId, clientId, userId },
            });
            if (resolved.spec.thirdPartyUnsupported) {
                throw new IeeError(`Action is not supported for third-party clients (${resolved.spec.sdkActionType}).`, "THIRD_PARTY_ACTION_UNSUPPORTED", { sdkActionType: resolved.spec.sdkActionType, serverActionType: resolved.spec.serverActionType });
            }
            const ieeService = new IeeService({ client: authClient });
            const ticket = await ieeService.createPrepTicket({
                actionType: resolved.spec.serverActionType,
                payload: resolved.payload,
            });
            const launchResult = await launcher.launch({
                ieeUrl,
                expectedIeeOrigin,
                receiptRequestId,
                ticketId: ticket.ticketId,
            });
            if (launchResult.status === "approved") {
                const extras = launchResult;
                const next = {
                    status: "approved",
                    receipt: launchResult.receipt,
                    actionType: resolved.spec.sdkActionType,
                    actionHash: launchResult.actionHash,
                    jti: launchResult.jti,
                    contextHash: extras.contextHash ?? extras.context_hash ?? null,
                    txIntent: extras.txIntent ?? extras.tx_intent ?? null,
                    userOpHash: extras.userOpHash ?? null,
                    installationId: extras.installationId ?? extras.installation_id ?? null,
                    preparationToken: extras.preparationToken ?? extras.preparation_token ?? null,
                    transactionHash: extras.transactionHash ?? null,
                    resolvedPayload: extras.resolvedPayload ??
                        extras.resolved_payload ??
                        null,
                };
                setState(next);
                return next;
            }
            if (launchResult.status === "cancelled") {
                const next = { status: "cancelled" };
                setState(next);
                return next;
            }
            const next = {
                status: "error",
                error: launchResult.error,
            };
            setState(next);
            return next;
        }
        catch (error) {
            const code = typeof error?.code === "string"
                ? String(error.code)
                : "IEE_RECEIPT_FAILED";
            const next = {
                status: "error",
                error: {
                    code,
                    message: error instanceof Error ? error.message : "SafeApprove receipt action failed.",
                },
            };
            setState(next);
            return next;
        }
        finally {
            // no-op
        }
    }, [authClient, clientId, expectedIeeOrigin, ieeUrl, launcher, tenantId, userId]);
    const reset = useCallback(() => setState({ status: "idle" }), []);
    return useMemo(() => ({
        state,
        run,
        reset,
    }), [state, run, reset]);
}
