"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCreatePaymentRequest, useIncomingPaymentRequestHistory, useOutgoingPaymentRequestHistory, useCancelPaymentRequest, useDeclinePaymentRequest, useRemindPaymentRequest, useTenantConfig, useIeeReceiptAction, useIeeContext, useAccountState, } from "@xkova/sdk-react";
import { Mail, Inbox, Send, Copy, RefreshCw, Loader2, AlertCircle, Link as LinkIcon, X, XCircle, Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Button } from "./ui/button.js";
import { Label } from "./ui/label.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { Badge } from "./ui/badge.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { toastError, toastSuccess } from "../toast-utils.js";
import { Input } from "./ui/input.js";
const REQUEST_CREATED_EVENT = "xkova:payment-request-created";
const buildPayUrlFromBaseUrl = (baseUrl, publicToken) => {
    const base = String(baseUrl || "").replace(/\/$/, "");
    return `${base}/pay/${encodeURIComponent(publicToken)}`;
};
const normalizeTenantAuthBaseUrl = (authDomain) => {
    const raw = String(authDomain ?? "").trim();
    if (!raw)
        return null;
    // Prefer a caller-supplied absolute URL.
    if (raw.includes("://")) {
        try {
            return new URL(raw).origin;
        }
        catch {
            return raw.replace(/\/$/, "");
        }
    }
    // Use the current protocol when available (helps localhost/http dev),
    // but default to https for tenant domains.
    const protocol = typeof window !== "undefined" && window.location?.protocol
        ? window.location.protocol
        : "https:";
    return `${protocol}//${raw}`;
};
const copyText = async (text) => {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            toastSuccess("Copied");
            return;
        }
    }
    catch (_) { }
    // Fallback
    if (typeof document === "undefined")
        return;
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    toastSuccess("Copied");
};
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
const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "pending")
        return _jsx(Badge, { variant: "secondary", children: "Pending" });
    if (s === "completed")
        return _jsx(Badge, { className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200", children: "Completed" });
    if (s === "declined")
        return _jsx(Badge, { variant: "outline", children: "Declined" });
    if (s === "cancelled")
        return _jsx(Badge, { variant: "outline", children: "Cancelled" });
    if (s === "expired")
        return _jsx(Badge, { variant: "outline", children: "Expired" });
    if (s === "failed")
        return _jsx(Badge, { variant: "outline", children: "Failed" });
    return _jsx(Badge, { variant: "outline", children: status });
};
/**
 * Request money from a payer by email.
 *
 * @remarks
 * Purpose:
 * - Create a P2P payment request and generate a hosted pay link.
 *
 * When to use:
 * - Use when requesting payments via email from end users.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: RequestPaymentCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Displays inline errors and toasts on request failures.
 *
 * Side effects:
 * - Issues API calls to create payment requests and emits browser events.
 *
 * Invariants/assumptions:
 * - Uses tenant auth domain to build hosted pay links.
 *
 * Data/auth references:
 * - Uses `/api/v1/payments/requests` via sdk-react hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <RequestPaymentCard defaultPayerEmail="payer@example.com" />
 */
export function RequestPaymentCard({ defaultPayerEmail }) {
    const { create, isLoading: creating } = useCreatePaymentRequest();
    const { tokens, tenant, networks } = useTenantConfig();
    const { account } = useAccountState();
    const { tenantId, clientId, userId } = useIeeContext();
    const iee = useIeeReceiptAction();
    const [payerEmail, setPayerEmail] = useState(() => defaultPayerEmail ?? "");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [submitError, setSubmitError] = useState(null);
    const [lastCreated, setLastCreated] = useState(null);
    const primaryTokenSymbol = useMemo(() => {
        const list = tokens ?? [];
        const primary = list.find((t) => Boolean(t?.isPrimary)) ??
            list.find((t) => Boolean(t?.isDefault)) ??
            list[0] ??
            null;
        const sym = String(primary?.symbol || "").trim();
        return sym || "USDC";
    }, [tokens]);
    const authBaseUrl = useMemo(() => normalizeTenantAuthBaseUrl(tenant?.authDomain), [tenant?.authDomain]);
    const buildPayUrl = useCallback((publicToken) => {
        if (!authBaseUrl)
            return "";
        return buildPayUrlFromBaseUrl(authBaseUrl, publicToken);
    }, [authBaseUrl]);
    const onSubmit = useCallback(async (e) => {
        e.preventDefault();
        setSubmitError(null);
        setLastCreated(null);
        try {
            const trimmedEmail = payerEmail.trim();
            if (!trimmedEmail) {
                throw new Error("payerEmail is required");
            }
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const requestorAccount = account ?? null;
            if (!requestorAccount) {
                throw new Error("No account available for requestor");
            }
            const primaryToken = (tokens || []).find((t) => t.isPrimary) ??
                (tokens || []).find((t) => t.isDefault) ??
                (tokens || [])[0] ??
                null;
            const decimals = Number(primaryToken?.decimals ?? 18);
            const amountRaw = String(amount || "").trim();
            if (!amountRaw || Number(amountRaw) <= 0) {
                throw new Error("amount must be > 0");
            }
            let amountWei;
            try {
                amountWei = parseUnits(amountRaw, decimals).toString();
            }
            catch {
                throw new Error("Invalid amount; enter a numeric value");
            }
            const networkId = (networks || []).find((n) => n?.networkId)?.networkId ??
                (networks || [])[0]?.networkId ??
                "43113";
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const description = note || undefined;
            const receiptResult = await iee.run({
                actionType: "payment_request_create_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    payment_request_type: "P2P",
                    transaction_type: "p2p_request",
                    amount_wei: amountWei,
                    fee_amount_wei: "0",
                    network_id: String(networkId),
                    account: requestorAccount,
                    payer_email: trimmedEmail,
                    note: description,
                    expires_at: expiresAt,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            const created = await create({
                payerEmail: trimmedEmail,
                amount: amountRaw,
                description,
                expiresAt,
                requestorAccount,
                networkId: String(networkId),
            }, { receipt: receiptResult.receipt });
            setLastCreated(created);
            setPayerEmail(defaultPayerEmail ?? "");
            setAmount("");
            setNote("");
            // Let other cards react without direct coupling.
            window.dispatchEvent(new CustomEvent(REQUEST_CREATED_EVENT, {
                detail: { requestId: created?.requestId, publicToken: created?.publicToken },
            }));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Request creation failed";
            setSubmitError(message);
            toastError("RequestPaymentCard create failed", err, "Request creation failed");
        }
    }, [
        account,
        amount,
        buildPayUrl,
        clientId,
        create,
        defaultPayerEmail,
        iee,
        networks,
        note,
        payerEmail,
        tenantId,
        tokens,
        userId,
    ]);
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { className: "h-full flex flex-col", children: [_jsxs(CardHeader, { className: "space-y-4", children: [_jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Mail, { className: "size-5" }), "Request"] }) }), _jsx(CardDescription, { children: "Request money by email, then share a hosted pay link." })] }), _jsxs(CardContent, { className: "flex-1", children: [_jsxs("form", { className: "space-y-4", onSubmit: onSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "payerEmail", children: "Payer email" }), _jsx(Input, { id: "payerEmail", placeholder: "payer@example.com", value: payerEmail, onChange: (e) => setPayerEmail(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: "amount", children: "Amount" }), _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Token: ", _jsx("span", { className: "font-medium text-foreground", children: primaryTokenSymbol })] })] }), _jsx(Input, { id: "amount", placeholder: "10.00", value: amount, onChange: (e) => setAmount(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: "note", children: "Note (optional)" }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [note.length, "/200"] })] }), _jsx("textarea", { id: "note", placeholder: "What is this for?", value: note, maxLength: 200, onChange: (e) => setNote(e.target.value), className: "flex min-h-[80px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" })] }), submitError ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm", children: [_jsx(AlertCircle, { className: "mt-0.5 size-4 text-destructive" }), _jsx("div", { className: "text-destructive", children: submitError })] })) : null, _jsx("div", { className: "flex items-center gap-3", children: _jsxs(Button, { type: "submit", disabled: creating, children: [creating ? _jsx(Loader2, { className: "mr-2 size-4 animate-spin" }) : _jsx(Send, { className: "mr-2 size-4" }), "Create request"] }) })] }), lastCreated?.publicToken ? (_jsx("div", { className: "mt-4 rounded-md border bg-muted/30 p-3", children: _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(LinkIcon, { className: "size-4 text-muted-foreground" }), _jsx("span", { className: "font-medium", children: "Pay link ready" }), lastCreated?.payerEmail ? (_jsxs("span", { className: "text-muted-foreground", children: ["(sent to ", _jsx("span", { className: "font-medium text-foreground", children: String(lastCreated.payerEmail) }), ")"] })) : null] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { size: "icon-sm", variant: "outline", onClick: () => copyText(buildPayUrl(lastCreated.publicToken)), disabled: !authBaseUrl, "aria-label": "Copy pay link", children: _jsx(Copy, {}) }) }) }), _jsx(TooltipContent, { children: "Copy pay link" })] }) })] }) })) : null] })] }) }));
}
/**
 * Displays payment request history (incoming + outgoing) in a single, merged table.
 *
 * @remarks
 * Purpose:
 * - Combine incoming and outgoing payment requests into a unified list.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when providing a unified request history view.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces inline errors when fetch or action calls fail.
 *
 * Side effects:
 * - Issues API calls and launches IEE (SafeApprove) approval flows for request actions.
 *
 * Invariants/assumptions:
 * - Merges results client-side and sorts by `createdAt`.
 *
 * Data/auth references:
 * - Uses `/api/v1/payments/requests/incoming` and `/api/v1/payments/requests/transactions`.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 */
export function RequestHistoryCard() {
    const { tenant } = useTenantConfig();
    const authBaseUrl = useMemo(() => normalizeTenantAuthBaseUrl(tenant?.authDomain), [tenant?.authDomain]);
    const buildPayUrl = useCallback((publicToken) => {
        if (!authBaseUrl)
            return "";
        return buildPayUrlFromBaseUrl(authBaseUrl, publicToken);
    }, [authBaseUrl]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [pageSize, setPageSize] = useState(10);
    const [pageIndex, setPageIndex] = useState(0);
    const effectiveStatus = statusFilter === "all" ? undefined : statusFilter;
    const needed = (pageIndex + 1) * pageSize + 1;
    const fetchLimit = Math.min(needed, 100);
    const query = useMemo(() => ({
        type: "P2P",
        status: effectiveStatus,
        // Fetch enough rows from each list so the merged view can be paginated locally.
        limit: fetchLimit,
        offset: 0,
    }), [effectiveStatus, fetchLimit]);
    const incoming = useIncomingPaymentRequestHistory(query);
    const outgoing = useOutgoingPaymentRequestHistory(query);
    const { tenantId, clientId, userId } = useIeeContext();
    const iee = useIeeReceiptAction();
    const { cancel: cancelRequest } = useCancelPaymentRequest();
    const { decline: declineRequest } = useDeclinePaymentRequest();
    const { remind: remindRequest } = useRemindPaymentRequest();
    const [cancellingId, setCancellingId] = useState(null);
    const [decliningId, setDecliningId] = useState(null);
    const [remindingId, setRemindingId] = useState(null);
    const canPrev = pageIndex > 0;
    const mergedRequests = useMemo(() => {
        const list = [];
        const seen = new Set();
        const add = (requests, direction) => {
            for (const r of requests ?? []) {
                const key = String(r?.id ?? r?.requestId ?? "");
                if (!key || seen.has(key))
                    continue;
                seen.add(key);
                list.push({ ...r, direction });
            }
        };
        add(incoming.requests, "incoming");
        add(outgoing.requests, "outgoing");
        const toEpoch = (value) => {
            const t = Date.parse(String(value ?? ""));
            return Number.isFinite(t) ? t : 0;
        };
        list.sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
        return list;
    }, [incoming.requests, outgoing.requests]);
    const hasNext = mergedRequests.length > (pageIndex + 1) * pageSize;
    const canNext = hasNext;
    const pageRequests = mergedRequests.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
    const onRefresh = useCallback(() => {
        outgoing.refetch();
        incoming.refetch();
    }, [incoming, outgoing]);
    const handleCancel = useCallback(async (requestId) => {
        try {
            setCancellingId(requestId);
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const receiptResult = await iee.run({
                actionType: "payment_request_cancel_v1",
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
            await cancelRequest(requestId, { receipt: receiptResult.receipt });
            toastSuccess("Payment request cancelled successfully");
            outgoing.refetch();
        }
        catch (err) {
            toastError("Cancel payment request", err, "Failed to cancel payment request");
        }
        finally {
            setCancellingId(null);
        }
    }, [cancelRequest, clientId, iee, outgoing, tenantId, userId]);
    const handleDecline = useCallback(async (requestId) => {
        try {
            setDecliningId(requestId);
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
            await declineRequest(requestId, { receipt: receiptResult.receipt });
            toastSuccess("Payment request declined successfully");
            incoming.refetch();
        }
        catch (err) {
            toastError("Decline payment request", err, "Failed to decline payment request");
        }
        finally {
            setDecliningId(null);
        }
    }, [clientId, declineRequest, iee, incoming, tenantId, userId]);
    const handleRemind = useCallback(async (requestId) => {
        try {
            setRemindingId(requestId);
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const receiptResult = await iee.run({
                actionType: "payment_request_remind_v1",
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
            await remindRequest(requestId, { receipt: receiptResult.receipt });
            toastSuccess("Reminder sent");
            outgoing.refetch();
            incoming.refetch();
        }
        catch (err) {
            toastError("Remind payment request", err, "Failed to send reminder");
        }
        finally {
            setRemindingId(null);
        }
    }, [clientId, iee, incoming, outgoing, remindRequest, tenantId, userId]);
    // Auto-refresh the list exactly once per successful "create request" action.
    useEffect(() => {
        const handler = () => {
            setPageIndex(0);
            // Refresh both so the new request appears in outgoing immediately.
            outgoing.refetch();
            incoming.refetch();
        };
        window.addEventListener(REQUEST_CREATED_EVENT, handler);
        return () => window.removeEventListener(REQUEST_CREATED_EVENT, handler);
    }, [incoming, outgoing]);
    const isLoading = incoming.isLoading || outgoing.isLoading;
    const error = incoming.error || outgoing.error;
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { className: "h-full flex flex-col", children: [_jsxs(CardHeader, { className: "space-y-4", children: [_jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Inbox, { className: "size-5" }), "Request History"] }), actions: _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "outline", size: "sm", onClick: onRefresh, disabled: isLoading, children: [_jsx(RefreshCw, { className: isLoading ? "mr-2 size-4 animate-spin" : "mr-2 size-4" }), "Refresh"] }) }) }), _jsx(CardDescription, { children: "View incoming and outgoing requests across all statuses, and open the hosted pay link when needed." })] }), _jsx(CardContent, { className: "flex-1 min-h-0", children: _jsxs("div", { className: "flex h-full flex-col gap-3", children: [_jsx("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Label, { className: "text-xs text-muted-foreground", children: "Status" }), _jsxs("select", { className: "h-9 rounded-md border bg-background px-3 text-sm", value: statusFilter, onChange: (e) => { setStatusFilter(e.target.value); setPageIndex(0); }, children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "pending", children: "Pending" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "declined", children: "Declined" }), _jsx("option", { value: "cancelled", children: "Cancelled" }), _jsx("option", { value: "expired", children: "Expired" }), _jsx("option", { value: "failed", children: "Failed" })] }), _jsx(Label, { className: "text-xs text-muted-foreground", children: "Rows" }), _jsxs("select", { className: "h-9 rounded-md border bg-background px-3 text-sm", value: pageSize, onChange: (e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }, children: [_jsx("option", { value: 5, children: "5" }), _jsx("option", { value: 10, children: "10" }), _jsx("option", { value: 20, children: "20" })] })] }) }), error ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm shrink-0", children: [_jsx(AlertCircle, { className: "mt-0.5 size-4 text-destructive" }), _jsx("div", { className: "text-destructive", children: String(error?.message || "Failed to load requests") })] })) : null, _jsx("div", { className: "space-y-3 sm:hidden", children: isLoading ? (_jsxs("div", { className: "py-8 text-center text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "mx-auto mb-2 size-4 animate-spin" }), "Loading..."] })) : pageRequests.length === 0 ? (_jsx("div", { className: "py-8 text-center text-sm text-muted-foreground", children: "No requests found" })) : (pageRequests.map((r) => {
                                    const payUrl = r.publicToken ? buildPayUrl(r.publicToken) : "";
                                    const isIncoming = r.direction === "incoming";
                                    const counterpartyRaw = isIncoming ? r.requesterUserId : r.payerEmail;
                                    const counterparty = String(counterpartyRaw ?? "—");
                                    return (_jsxs("div", { className: "rounded-lg border border-border/60 p-3 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [isIncoming ? (_jsx(Inbox, { className: "size-4 text-emerald-600" })) : (_jsx(Send, { className: "size-4 text-blue-600" })), _jsx("span", { className: "text-xs text-muted-foreground", children: isIncoming ? "Incoming" : "Outgoing" })] }), getStatusBadge(r.status)] }), _jsxs("div", { className: "space-y-1 text-sm", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Counterparty" }), _jsx("div", { className: "font-mono break-words", children: counterparty })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsx("span", { className: "font-medium", children: formatAmount(r) }), _jsx("span", { className: "text-xs text-muted-foreground", children: formatDate(r.createdAt) })] }), _jsxs("div", { className: "flex flex-wrap gap-2 pt-1", children: [_jsx(Button, { size: "icon-sm", variant: "outline", disabled: !payUrl, onClick: () => copyText(payUrl), "aria-label": "Copy pay link", children: _jsx(Copy, {}) }), _jsx(Button, { size: "icon-sm", variant: "outline", disabled: !payUrl, onClick: () => window.open(payUrl, "_blank", "noopener,noreferrer"), "aria-label": "Open pay link", children: _jsx(LinkIcon, {}) }), isIncoming && r.status === "pending" && (_jsx(Button, { size: "icon-sm", variant: "destructive", disabled: decliningId === r.requestId, onClick: () => handleDecline(r.requestId), "aria-label": "Decline request", children: decliningId === r.requestId ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsx(XCircle, { className: "size-4" })) })), !isIncoming && r.status === "pending" && (_jsx(Button, { size: "icon-sm", variant: "destructive", disabled: cancellingId === r.requestId, onClick: () => handleCancel(r.requestId), "aria-label": "Cancel request", children: cancellingId === r.requestId ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsx(X, { className: "size-4" })) })), r.status === "pending" && (_jsx(Button, { size: "icon-sm", variant: "outline", disabled: remindingId === r.requestId, onClick: () => handleRemind(r.requestId), "aria-label": "Remind payer", children: remindingId === r.requestId ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsx(Bell, { className: "size-4" })) }))] })] }, r.id || r.requestId));
                                })) }), _jsx("div", { className: "hidden sm:block rounded-lg border flex-1 min-h-0 overflow-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-10", "aria-label": "Direction", children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "block h-full w-full", "aria-hidden": "true" }) }), _jsx(TooltipContent, { children: "Direction" })] }) }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "Counterparty" }), _jsx(TableHead, { children: "Amount" }), _jsx(TableHead, { children: "Created" }), _jsx(TableHead, { className: "text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: isLoading ? (_jsx(TableRow, { children: _jsxs(TableCell, { colSpan: 6, className: "py-8 text-center text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "mx-auto mb-2 size-4 animate-spin" }), "Loading..."] }) })) : pageRequests.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "py-8 text-center text-sm text-muted-foreground", children: "No requests found" }) })) : (pageRequests.map((r) => {
                                                const payUrl = r.publicToken ? buildPayUrl(r.publicToken) : "";
                                                const isIncoming = r.direction === "incoming";
                                                const counterpartyRaw = isIncoming ? r.requesterUserId : r.payerEmail;
                                                const counterparty = String(counterpartyRaw ?? "—");
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex items-center justify-center", "aria-label": isIncoming ? "Incoming" : "Outgoing", children: isIncoming ? (_jsx(Inbox, { className: "size-4 text-emerald-600" })) : (_jsx(Send, { className: "size-4 text-blue-600" })) }) }), _jsx(TooltipContent, { children: isIncoming ? "Incoming" : "Outgoing" })] }) }), _jsx(TableCell, { children: getStatusBadge(r.status) }), _jsx(TableCell, { className: "font-mono text-xs", children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "block truncate", "aria-label": counterparty, children: counterparty }) }), _jsx(TooltipContent, { children: counterparty })] }) }), _jsx(TableCell, { children: formatAmount(r) }), _jsx(TableCell, { className: "text-muted-foreground", children: formatDate(r.createdAt) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { size: "icon-sm", variant: "outline", disabled: !payUrl, onClick: () => copyText(payUrl), "aria-label": "Copy pay link", children: _jsx(Copy, {}) }) }) }), _jsx(TooltipContent, { children: "Copy pay link" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { size: "icon-sm", variant: "outline", disabled: !payUrl, onClick: () => window.open(payUrl, "_blank", "noopener,noreferrer"), "aria-label": "Open pay link", children: _jsx(LinkIcon, {}) }) }) }), _jsx(TooltipContent, { children: "Open pay link" })] }), isIncoming && r.status === "pending" && (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { size: "icon-sm", variant: "destructive", disabled: decliningId === r.requestId, onClick: () => handleDecline(r.requestId), "aria-label": "Decline request", children: decliningId === r.requestId ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsx(XCircle, { className: "size-4" })) }) }) }), _jsx(TooltipContent, { children: "Decline request" })] })), !isIncoming && r.status === "pending" && (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { size: "icon-sm", variant: "destructive", disabled: cancellingId === r.requestId, onClick: () => handleCancel(r.requestId), "aria-label": "Cancel request", children: cancellingId === r.requestId ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsx(X, { className: "size-4" })) }) }) }), _jsx(TooltipContent, { children: "Cancel request" })] })), r.status === "pending" && (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { size: "icon-sm", variant: "outline", disabled: remindingId === r.requestId, onClick: () => handleRemind(r.requestId), "aria-label": "Remind payer", children: remindingId === r.requestId ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsx(Bell, { className: "size-4" })) }) }) }), _jsx(TooltipContent, { children: "Send reminder" })] }))] }) })] }, r.id || r.requestId));
                                            })) })] }) }), _jsxs("div", { className: "flex items-center justify-between shrink-0", children: [_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Page ", pageIndex + 1] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: !canPrev, onClick: () => setPageIndex((p) => Math.max(0, p - 1)), children: "Prev" }), _jsx(Button, { variant: "outline", size: "sm", disabled: !canNext, onClick: () => setPageIndex((p) => p + 1), children: "Next" })] })] })] }) })] }) }));
}
