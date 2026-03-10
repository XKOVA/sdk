"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { usePendingPaymentRequestsInbox, usePayPendingPaymentRequest, useIeeReceiptAction, useIeeContext, useTenantConfig, normalizeTenantAuthBaseUrl, } from "@xkova/sdk-react";
import { useCallback, useState } from "react";
import { Inbox, Loader2, RefreshCw, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Button } from "./ui/button.js";
import { toastError, toastSuccess } from "../toast-utils.js";
const formatAmount = (r) => {
    const decimals = Number(r.tokenDecimals ?? 18);
    const amountWei = typeof r.amountWei === "string" ? r.amountWei : String(r.amountWei ?? "0");
    const value = BigInt(amountWei);
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
    const sym = r.tokenSymbol ?? "TOKEN";
    return `${whole}.${fractionStr} ${sym}`;
};
const formatDate = (timestamp) => {
    if (!timestamp)
        return "-";
    try {
        const d = new Date(timestamp);
        if (isNaN(d.getTime()))
            return "-";
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    catch {
        return "-";
    }
};
const buildPayUrlFromBaseUrl = (baseUrl, publicToken) => {
    const base = String(baseUrl || "").replace(/\/$/, "");
    return `${base}/pay/${encodeURIComponent(publicToken)}`;
};
/**
 * Render the authenticated user's pending incoming payment requests.
 *
 * @remarks
 * Purpose:
 * - Provide a ready-to-use inbox surface for pending requests.
 * - Supports manual refresh and decline actions via IEE receipts.
 * - Pay can open the hosted pay link or run the in-app send + complete flow.
 *
 * When to use:
 * - Use on authenticated pages where the payer should see incoming requests.
 *
 * When not to use:
 * - Do not use for outgoing requests created by the current user.
 */
export function PendingPaymentRequestsInbox({ className, type = "P2P", autoRefreshMs, payMode = "hosted", sendTransactionType, }) {
    const { requests, isLoading, error, refetch, decline } = usePendingPaymentRequestsInbox({
        type,
        autoRefreshMs,
    });
    const { pay } = usePayPendingPaymentRequest();
    const { tenant } = useTenantConfig();
    const iee = useIeeReceiptAction();
    const { tenantId, clientId, userId } = useIeeContext();
    const authBaseUrl = normalizeTenantAuthBaseUrl(tenant?.authDomain);
    const [payingId, setPayingId] = useState(null);
    const handleDecline = useCallback(async (requestId) => {
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const receiptResult = await iee.run({
                actionType: "payment_request_decline_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    payment_request_id: requestId,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            await decline(requestId, { receipt: receiptResult.receipt });
            toastSuccess("Payment request declined");
            refetch();
        }
        catch (err) {
            toastError("Decline payment request", err, "Failed to decline payment request");
        }
    }, [clientId, decline, iee, refetch, tenantId, userId]);
    const handlePay = useCallback(async (request) => {
        if (payMode === "hosted") {
            const publicToken = request?.publicToken ?? null;
            if (!publicToken)
                return;
            if (!authBaseUrl)
                return;
            const payUrl = buildPayUrlFromBaseUrl(authBaseUrl, publicToken);
            window.open(payUrl, "_blank", "noopener,noreferrer");
            return;
        }
        if (!sendTransactionType) {
            toastError("Pay payment request", new Error("sendTransactionType is required for in-app pay"), "Missing send transaction type");
            return;
        }
        const requestKey = String(request?.id ?? request?.requestId ?? "").trim();
        setPayingId(requestKey || "paying");
        try {
            await pay(request, { sendTransactionType });
            toastSuccess("Payment submitted");
            refetch();
        }
        catch (err) {
            toastError("Pay payment request", err, "Failed to pay payment request");
        }
        finally {
            setPayingId(null);
        }
    }, [authBaseUrl, pay, payMode, refetch, sendTransactionType]);
    if (isLoading && requests.length === 0) {
        return (_jsx("div", { className: className, children: _jsx(Card, { children: _jsxs(CardContent, { className: "py-8 text-center text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "mx-auto mb-2 size-4 animate-spin" }), "Loading pending requests..."] }) }) }));
    }
    if (error) {
        return (_jsx("div", { className: className, children: _jsx(Card, { children: _jsx(CardContent, { className: "py-6 text-sm text-destructive", children: String(error?.message || "Failed to load pending requests") }) }) }));
    }
    if (!requests.length)
        return null;
    return (_jsx("div", { className: className, children: _jsxs(Card, { children: [_jsxs(CardHeader, { className: "space-y-3", children: [_jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Inbox, { className: "size-5" }), "Pending Requests"] }), actions: _jsxs(Button, { variant: "outline", size: "sm", onClick: () => refetch(), children: [_jsx(RefreshCw, { className: "mr-2 size-4" }), "Refresh"] }) }), _jsxs(CardDescription, { children: [requests.length, " request", requests.length !== 1 ? "s" : "", " waiting for your action."] })] }), _jsx(CardContent, { className: "space-y-3", children: requests.map((req) => (_jsxs("div", { className: "rounded-lg border border-border/60 p-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-medium truncate", children: req.requesterEmail ?? "Requestor" }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [formatDate(req.createdAt), " \u00B7 ", req.status] }), req.description ? (_jsx("div", { className: "mt-1 text-xs text-muted-foreground", children: req.description })) : null] }), _jsx("div", { className: "text-right", children: _jsx("div", { className: "text-sm font-medium", children: formatAmount(req) }) })] }), _jsx("div", { className: "mt-3 flex gap-2", children: (() => {
                                    const requestKey = String(req.id ?? req.requestId ?? "").trim();
                                    const isPaying = payingId === requestKey && requestKey.length > 0;
                                    const payDisabled = payMode === "hosted"
                                        ? !req.publicToken || !authBaseUrl
                                        : !sendTransactionType || Boolean(payingId);
                                    const declineDisabled = Boolean(payingId);
                                    return (_jsxs(_Fragment, { children: [_jsxs(Button, { size: "sm", onClick: () => handlePay(req), disabled: payDisabled, children: [isPaying ? _jsx(Loader2, { className: "mr-2 size-4 animate-spin" }) : null, !isPaying && payMode === "hosted" ? (_jsx(ExternalLink, { className: "mr-2 size-4" })) : null, isPaying ? "Paying..." : "Pay"] }), _jsxs(Button, { variant: "outline", size: "sm", disabled: declineDisabled, onClick: () => handleDecline(String(req.id ?? req.requestId)), children: [_jsx(X, { className: "mr-2 size-4" }), "Decline"] })] }));
                                })() })] }, req.id ?? req.requestId))) })] }) }));
}
