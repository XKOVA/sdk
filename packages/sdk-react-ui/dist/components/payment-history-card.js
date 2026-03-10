"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCancelPendingPaymentOnchain, useSendPaymentHistory, useRemindSendPayment, useTenantConfig, useIeeReceiptAction, useIeeContext } from "@xkova/sdk-react";
import { useMemo, useState } from "react";
import { Clock, Shield, Check, X, ExternalLink, RefreshCw, AlertCircle, Mail, Bell } from "lucide-react";
import { notify as notifyToast } from "../toast-utils.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Badge } from "./ui/badge.js";
import { Skeleton } from "./ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { useRefreshState } from "./use-refresh-state.js";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "./ui/alert-dialog.js";
import { SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue } from "./ui/select-menu.js";
/**
 * Payment history card.
 *
 * @remarks
 * Purpose:
 * - List sent payment history and allow IEE (SafeApprove)-gated actions on pending payments.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when showing pending payment activity for the user.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: PaymentHistoryCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces API errors via toast messaging.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Triggers API fetches and cancel flows.
 *
 * Invariants/assumptions:
 * - Shows all send payment statuses; pending actions are conditionally available.
 *
 * Data/auth references:
 * - Uses `/api/v1/payments/send` via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <PaymentHistoryCard />
 */
export function PaymentHistoryCard({ onToast }) {
    const notify = (type, message, err) => {
        notifyToast(type, message, {
            onToast,
            ...(type === "error" ? { error: err, context: "PaymentHistoryCard", fallbackForError: "Action failed. Please try again." } : {}),
        });
    };
    const [statusFilter, setStatusFilter] = useState("all");
    const [pageSize, setPageSize] = useState(10);
    const [pageIndex, setPageIndex] = useState(0);
    const { networks } = useTenantConfig();
    const { tenantId, clientId, userId } = useIeeContext();
    const offset = pageIndex * pageSize;
    const effectiveStatus = statusFilter === "all" ? undefined : statusFilter;
    const paymentFilter = useMemo(() => ({
        status: effectiveStatus,
        // Fetch 1 extra row so we can enable/disable "Next" without needing a total count.
        limit: pageSize + 1,
        offset,
    }), [effectiveStatus, pageSize, offset]);
    const { payments, isLoading, refetch } = useSendPaymentHistory(paymentFilter);
    const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, (payments?.length ?? 0) > 0);
    const iee = useIeeReceiptAction();
    const { remind: remindSendPayment, isLoading: isReminding } = useRemindSendPayment();
    const { cancelOnchain, isLoading: isOnchainCancelling } = useCancelPendingPaymentOnchain();
    const [paymentToCancel, setPaymentToCancel] = useState(null);
    const [remindingId, setRemindingId] = useState(null);
    const [onchainCancellingId, setOnchainCancellingId] = useState(null);
    const canPrev = pageIndex > 0;
    const hasNext = (payments?.length ?? 0) > pageSize;
    const canNext = hasNext;
    const pagePayments = (payments ?? []).slice(0, pageSize);
    const formatAmount = (payment) => {
        const decimals = Number(payment.tokenDecimals ?? 18);
        const amountWei = typeof payment.amountWei === "string" ? payment.amountWei : String(payment.amountWei ?? "0");
        const amount = BigInt(amountWei);
        const divisor = 10n ** BigInt(decimals);
        const whole = amount / divisor;
        const fraction = amount % divisor;
        const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
        return `${whole}.${fractionStr} ${payment.tokenSymbol ?? "TOKEN"}`;
    };
    const getExplorerTxUrl = (networkId, transactionHash) => {
        if (!transactionHash)
            return null;
        const normalizedNetworkId = networkId !== null && networkId !== undefined ? String(networkId) : null;
        const net = networks?.find((n) => String(n.networkId) === normalizedNetworkId);
        const explorerBase = net?.explorerUrl ??
            net?.explorer_url ??
            null;
        if (!explorerBase)
            return null;
        return `${String(explorerBase).replace(/\/+$/, "")}/tx/${transactionHash}`;
    };
    const formatDate = (timestamp) => {
        try {
            const d = new Date(timestamp);
            if (isNaN(d.getTime()))
                return "-";
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1)
                return "just now";
            if (diffMins < 60)
                return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24)
                return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7)
                return `${diffDays}d ago`;
            return d.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            });
        }
        catch {
            return "-";
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case "pending":
                return (_jsxs(Badge, { variant: "secondary", className: "gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200", children: [_jsx(Clock, { className: "size-3" }), "Pending"] }));
            case "completed":
                return (_jsxs(Badge, { variant: "default", className: "gap-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200", children: [_jsx(Check, { className: "size-3" }), "Completed"] }));
            case "failed":
                return (_jsxs(Badge, { variant: "secondary", className: "gap-1 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200", children: [_jsx(X, { className: "size-3" }), "Failed"] }));
            case "expired":
                return (_jsxs(Badge, { variant: "secondary", className: "gap-1 bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200", children: [_jsx(Clock, { className: "size-3" }), "Expired"] }));
            case "cancelled":
                return (_jsxs(Badge, { variant: "outline", className: "gap-1", children: [_jsx(X, { className: "size-3" }), "Cancelled"] }));
            default:
                return _jsx(Badge, { variant: "outline", children: status });
        }
    };
    const handleRemind = async (payment) => {
        setRemindingId(payment.id);
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const receiptResult = await iee.run({
                actionType: "send_payment_remind_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    payment_transfer_id: payment.id,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            await remindSendPayment(payment.id, { receipt: receiptResult.receipt });
            notify("success", "Reminder sent");
            await refetch();
        }
        catch (err) {
            notify("error", "Could not send reminder. Please try again.", err);
        }
        finally {
            setRemindingId(null);
        }
    };
    const handleCancelOnchain = async (payment) => {
        setOnchainCancellingId(payment.id);
        try {
            const receiptResult = await iee.run({
                actionType: "send_payment_cancel_onchain_v1",
                payload: {
                    payment_transfer_id: payment.id,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            const cancelTxHash = receiptResult.transactionHash ?? receiptResult.userOpHash ?? null;
            if (!cancelTxHash || !/^0x[a-fA-F0-9]{64}$/.test(cancelTxHash.trim())) {
                throw new Error("SafeApprove approval did not return a valid transaction hash");
            }
            await cancelOnchain(payment.id, {
                cancelTxHash: cancelTxHash.trim(),
                receipt: receiptResult.receipt,
            });
            notify("success", "On-chain cancellation submitted");
            await refetch();
            setPaymentToCancel(null);
        }
        catch (err) {
            notify("error", "Could not cancel on-chain. Please try again.", err);
        }
        finally {
            setOnchainCancellingId(null);
        }
    };
    return (_jsxs(TooltipProvider, { delayDuration: 150, children: [_jsxs(Card, { className: "h-full flex flex-col", children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Mail, { className: "size-5" }), "Payment History"] }), description: _jsx(CardDescription, { children: "Sent payments across all statuses, including escrowed and completed." }), actions: _jsxs("div", { className: "flex flex-wrap items-center justify-start gap-2 sm:justify-end", children: [_jsxs(SelectMenu, { value: statusFilter, onValueChange: (v) => {
                                            setStatusFilter(v);
                                            setPageIndex(0);
                                        }, children: [_jsx(SelectMenuTrigger, { className: "h-8 w-[170px]", children: _jsx(SelectMenuValue, { placeholder: "Filter status" }) }), _jsxs(SelectMenuContent, { children: [_jsx(SelectMenuItem, { value: "all", children: "All Statuses" }), _jsx(SelectMenuItem, { value: "pending", children: "Pending" }), _jsx(SelectMenuItem, { value: "completed", children: "Completed" }), _jsx(SelectMenuItem, { value: "cancelled", children: "Cancelled" }), _jsx(SelectMenuItem, { value: "failed", children: "Failed" }), _jsx(SelectMenuItem, { value: "expired", children: "Expired" })] })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { variant: "outline", size: "icon-sm", onClick: () => refetch(), disabled: isRefreshing, "aria-label": "Refresh", children: _jsx(RefreshCw, { className: `size-4 ${isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsx(TooltipContent, { children: "Refresh" })] })] }) }) }), _jsx(CardContent, { className: "flex flex-col gap-4 flex-1 min-h-0", children: isInitialLoading ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" })] })) : pagePayments && pagePayments.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "space-y-3 sm:hidden", children: pagePayments.map((payment) => {
                                        const txUrl = getExplorerTxUrl(payment.networkId, payment.transactionHash);
                                        const isRowReminding = remindingId === payment.id || isReminding;
                                        const isRowOnchainCancelling = onchainCancellingId === payment.id || isOnchainCancelling;
                                        const canRemind = payment.status === "pending" && payment.isPendingPayment && payment.contactType === "email";
                                        const canCancelOnchain = payment.status === "pending" && payment.isPendingPayment;
                                        return (_jsxs("div", { className: "rounded-lg border border-border/60 p-3 space-y-2", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Recipient" }), _jsx("div", { className: "font-medium break-words", children: payment.recipientContact ?? "-" })] }), getStatusBadge(payment.status)] }), _jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsx("span", { className: "font-medium", children: formatAmount(payment) }), _jsx("span", { className: "text-xs text-muted-foreground", children: formatDate(payment.createdAt) })] }), _jsx("div", { className: "text-sm", children: txUrl ? (_jsxs("a", { href: txUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-primary hover:underline", children: ["View TX", _jsx(ExternalLink, { className: "size-3" })] })) : (_jsx("span", { className: "text-muted-foreground", children: "No tx link" })) }), _jsxs("div", { className: "flex flex-wrap gap-2 pt-1", children: [canCancelOnchain ? (_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPaymentToCancel(payment), disabled: isRowOnchainCancelling || isRowReminding, className: "h-8 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20", children: isRowOnchainCancelling ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "size-3 mr-1 animate-spin" }), "Cancelling"] })) : (_jsxs(_Fragment, { children: [_jsx(X, { className: "size-3 mr-1" }), "Cancel"] })) })) : (_jsx("span", { className: "text-muted-foreground text-xs", children: "No cancel action" })), canRemind ? (_jsx(Button, { variant: "outline", size: "sm", onClick: () => handleRemind(payment), disabled: isRowReminding || isRowOnchainCancelling, className: "h-8", children: isRowReminding ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "size-3 mr-1 animate-spin" }), "Sending"] })) : (_jsxs(_Fragment, { children: [_jsx(Bell, { className: "size-3 mr-1" }), "Remind"] })) })) : null] })] }, payment.id));
                                    }) }), _jsx("div", { className: "hidden sm:block rounded-md border flex-1 min-h-0 overflow-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Recipient" }), _jsx(TableHead, { children: "Amount" }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "Time" }), _jsx(TableHead, { children: "TX" }), _jsx(TableHead, { className: "text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: pagePayments.map((payment) => {
                                                    const txUrl = getExplorerTxUrl(payment.networkId, payment.transactionHash);
                                                    const isRowReminding = remindingId === payment.id || isReminding;
                                                    const isRowOnchainCancelling = onchainCancellingId === payment.id || isOnchainCancelling;
                                                    const canRemind = payment.status === "pending" && payment.isPendingPayment && payment.contactType === "email";
                                                    const canCancelOnchain = payment.status === "pending" && payment.isPendingPayment;
                                                    return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "max-w-[240px] truncate font-medium", children: payment.recipientContact ?? "-" }), _jsx(TableCell, { className: "sm:whitespace-nowrap", children: formatAmount(payment) }), _jsx(TableCell, { children: getStatusBadge(payment.status) }), _jsx(TableCell, { className: "sm:whitespace-nowrap", children: formatDate(payment.createdAt) }), _jsx(TableCell, { className: "sm:whitespace-nowrap", children: txUrl ? (_jsxs("a", { href: txUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-primary hover:underline", children: ["View", _jsx(ExternalLink, { className: "size-3" })] })) : (_jsx("span", { className: "text-muted-foreground", children: "-" })) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex flex-col items-end gap-2", children: [canCancelOnchain ? (_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPaymentToCancel(payment), disabled: isRowOnchainCancelling || isRowReminding, className: "h-8 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20", children: isRowOnchainCancelling ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "size-3 mr-1 animate-spin" }), "Cancelling"] })) : (_jsxs(_Fragment, { children: [_jsx(X, { className: "size-3 mr-1" }), "Cancel"] })) })) : (_jsx("span", { className: "text-muted-foreground", children: "-" })), canRemind ? (_jsx(Button, { variant: "outline", size: "sm", onClick: () => handleRemind(payment), disabled: isRowReminding || isRowOnchainCancelling, className: "h-8", children: isRowReminding ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "size-3 mr-1 animate-spin" }), "Sending"] })) : (_jsxs(_Fragment, { children: [_jsx(Bell, { className: "size-3 mr-1" }), "Remind"] })) })) : null] }) })] }, payment.id));
                                                }) })] }) }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Page ", pageIndex + 1] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(SelectMenu, { value: String(pageSize), onValueChange: (v) => {
                                                        setPageSize(Number(v));
                                                        setPageIndex(0);
                                                    }, children: [_jsx(SelectMenuTrigger, { className: "h-8 w-[120px]", children: _jsx(SelectMenuValue, { placeholder: "Rows" }) }), _jsxs(SelectMenuContent, { children: [_jsx(SelectMenuItem, { value: "10", children: "10 / page" }), _jsx(SelectMenuItem, { value: "20", children: "20 / page" }), _jsx(SelectMenuItem, { value: "50", children: "50 / page" })] })] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPageIndex((p) => Math.max(0, p - 1)), disabled: !canPrev, children: "Previous" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPageIndex((p) => p + 1), disabled: !canNext, children: "Next" })] })] })] })) : (_jsxs("div", { className: "text-center py-10 space-y-2", children: [_jsx(Shield, { className: "size-8 mx-auto text-muted-foreground" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["No payment history found", statusFilter !== "all" && ` with status "${statusFilter}"`] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Send a payment to see it here" })] })) })] }), _jsx(AlertDialog, { open: Boolean(paymentToCancel), onOpenChange: (open) => !open && setPaymentToCancel(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsxs(AlertDialogTitle, { className: "flex items-center gap-2", children: [_jsx(AlertCircle, { className: "size-5 text-red-500" }), "Cancel Pending Payment"] }), _jsxs(AlertDialogDescription, { children: ["Are you sure you want to cancel this payment to", " ", _jsx("span", { className: "font-semibold", children: paymentToCancel?.recipientContact }), paymentToCancel && (_jsxs(_Fragment, { children: [" ", "for", " ", _jsx("span", { className: "font-semibold", children: formatAmount(paymentToCancel) })] })), "?", _jsx("br", {}), _jsx("br", {}), "The funds will be returned to your account. This action cannot be undone."] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: isOnchainCancelling || Boolean(onchainCancellingId), children: "Keep Payment" }), _jsx(AlertDialogAction, { onClick: () => handleCancelOnchain(paymentToCancel), disabled: isOnchainCancelling || Boolean(onchainCancellingId), className: "bg-destructive text-white hover:bg-destructive/90", children: isOnchainCancelling || onchainCancellingId ? "Cancelling..." : "Yes, Cancel Payment" })] })] }) })] }));
}
