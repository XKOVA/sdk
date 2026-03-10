"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAccountState, useTenantConfig, useExecuteFaucetTransfer, useIeeReceiptAction, useIeeContext, useAuth, } from "@xkova/sdk-react";
import { selectTenantNetwork } from "@xkova/sdk-core";
import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { parseUnits } from "viem";
import { toastError, toastSuccess } from "../toast-utils.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogOverlay, DialogPortal } from "./ui/dialog.js";
import { Select } from "./ui/select.js";
import { Skeleton } from "./ui/skeleton.js";
import { Droplets, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useRefreshState } from "./use-refresh-state.js";
const toNumber = (v) => {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
        return Number(v);
    return null;
};
const formatUsd = (v) => {
    if (typeof v !== "number" || !Number.isFinite(v))
        return "Not specified";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
};
const selectPrimaryToken = (tokens) => tokens.find((t) => t.isPrimary || t.isDefault) ?? tokens[0] ?? null;
const normalizeRampProviderId = (providerId) => {
    const trimmed = providerId.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "faucet" || lower === "usdc_faucet")
        return "usdc-faucet";
    return trimmed;
};
/**
 * Transfers (deposit/withdraw) card.
 *
 * @remarks
 * Purpose:
 * - Provide a UI for deposit/withdraw flows using tenant transfer providers.
 *
 * When to use:
 * - Use when enabling end users to initiate transfers.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: TransfersCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces validation errors via inline messaging.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Opens provider URLs, opens iframe widgets, and may execute on-chain transactions.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK session.
 *
 * Data/auth references:
 * - Receipt-gated: client-side signing is disabled in the public SDK. Use the IEE (SafeApprove) iframe modal to obtain a receipt before calling receipt-gated endpoints.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <TransfersCard onSuccess={(tx) => void tx} />
 */
export function TransfersCard({ onStart, onSuccess, onError }) {
    const { transferProviders, networks, tokens, isLoading: configLoading } = useTenantConfig();
    const { account, isLoading: accountLoading } = useAccountState();
    const { user } = useAuth();
    const iee = useIeeReceiptAction();
    const { tenantId, clientId, userId } = useIeeContext();
    const txLoading = false;
    const { execute: executeFaucetTransferTx } = useExecuteFaucetTransfer();
    const [flow, setFlow] = useState("deposit");
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [amountInput, setAmountInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState(null);
    const iframeRef = useRef(null);
    const [widget, setWidget] = useState(null);
    const [widgetReady, setWidgetReady] = useState(false);
    const [widgetTimedOut, setWidgetTimedOut] = useState(false);
    const [bypassSubmitting, setBypassSubmitting] = useState(false);
    const network = useMemo(() => {
        try {
            return selectTenantNetwork(networks);
        }
        catch {
            return null;
        }
    }, [networks]);
    const primaryToken = useMemo(() => selectPrimaryToken(tokens ?? []), [tokens]);
    const availableProviders = useMemo(() => {
        const list = transferProviders ?? [];
        const wants = flow === "deposit" ? ["deposit"] : ["withdraw"];
        return list.filter((p) => {
            const supported = (p?.supportedTypes ?? p?.metadata?.supportedTypes ?? p?.metadata?.supported_types);
            const arr = Array.isArray(supported) ? supported : [];
            return arr.some((item) => wants.includes(item));
        });
    }, [transferProviders, flow]);
    const selectedProvider = useMemo(() => {
        if (!selectedProviderId)
            return availableProviders[0] ?? null;
        return availableProviders.find((p) => (p?.id ?? p?.providerId) === selectedProviderId) ?? null;
    }, [availableProviders, selectedProviderId]);
    const isFaucet = Boolean(selectedProvider?.faucetContract ?? selectedProvider?.metadata?.faucetContract);
    useEffect(() => {
        if (!widget)
            return;
        const iframe = iframeRef.current;
        if (!iframe)
            return;
        // Set legacy transparency without triggering React DOM warnings.
        iframe.setAttribute("allowtransparency", "true");
        // Set initial minimum height
        iframe.style.height = '500px';
    }, [widget]);
    useEffect(() => {
        if (!widget || widgetReady)
            return;
        setWidgetTimedOut(false);
        const timeoutId = window.setTimeout(() => {
            setWidgetTimedOut(true);
        }, 7000);
        return () => window.clearTimeout(timeoutId);
    }, [widget, widgetReady]);
    const minUsd = useMemo(() => {
        const raw = selectedProvider?.minAmountUsd ?? selectedProvider?.metadata?.minAmountUsd ?? selectedProvider?.metadata?.min_amount_usd;
        return toNumber(raw);
    }, [selectedProvider]);
    const maxUsd = useMemo(() => {
        const raw = selectedProvider?.maxAmountUsd ?? selectedProvider?.metadata?.maxAmountUsd ?? selectedProvider?.metadata?.max_amount_usd;
        return toNumber(raw);
    }, [selectedProvider]);
    useEffect(() => {
        // Default provider selection
        if (!selectedProviderId && availableProviders.length > 0) {
            const firstId = (availableProviders[0]?.id ?? availableProviders[0]?.providerId);
            if (firstId)
                setSelectedProviderId(firstId);
        }
    }, [availableProviders, selectedProviderId]);
    useEffect(() => {
        setErrorText(null);
        // For faucet deposits: prefill max_amount_usd (if present)
        if (flow === "deposit" && isFaucet && maxUsd !== null && maxUsd !== undefined) {
            setAmountInput(String(maxUsd));
            return;
        }
        // Otherwise clear
        setAmountInput("");
    }, [flow, isFaucet, maxUsd, selectedProviderId]);
    const validateAmount = useCallback(() => {
        if (!isFaucet)
            return null;
        const v = toNumber(amountInput);
        if (v === null)
            return "Enter a valid USD amount";
        if (v <= 0)
            return "Amount must be greater than 0";
        if (flow === "withdraw" && typeof minUsd === "number" && v < minUsd) {
            return `Minimum is ${formatUsd(minUsd)}`;
        }
        if (flow === "deposit" && typeof maxUsd === "number" && v > maxUsd) {
            return `Maximum is ${formatUsd(maxUsd)}`;
        }
        return null;
    }, [isFaucet, amountInput, flow, minUsd, maxUsd]);
    const postToWidget = useCallback((params) => {
        if (!widget)
            return;
        const win = iframeRef.current?.contentWindow;
        if (!win)
            return;
        try {
            win.postMessage(JSON.stringify({
                xkova: "transfer-provider-widget",
                version: 1,
                sessionId: widget.sessionId,
                type: params.type,
                payload: params.payload ?? {},
            }), widget.widgetOrigin);
        }
        catch {
            // ignore
        }
    }, [widget]);
    const executeFaucetTransfer = useCallback(async (params) => {
        if (!account) {
            throw new Error("Sign in to use transfer features");
        }
        const validationError = validateAmount();
        if (validationError) {
            setErrorText(validationError);
            throw new Error(validationError);
        }
        setSubmitting(true);
        try {
            const providerIdTrimmed = String(params.providerId || "").trim();
            const fiatAmountNumber = toNumber(params.amountUsd);
            const fiatAmount = typeof fiatAmountNumber === "number" && Number.isFinite(fiatAmountNumber)
                ? fiatAmountNumber.toFixed(2)
                : null;
            const tokenDecimalsRaw = primaryToken?.decimals;
            const tokenDecimalsParsed = Number(tokenDecimalsRaw);
            const tokenDecimals = Number.isFinite(tokenDecimalsParsed) ? tokenDecimalsParsed : 18;
            const recordContract = typeof primaryToken?.contract === "string" && primaryToken.contract.trim().length > 0
                ? primaryToken.contract
                : undefined;
            const cryptoSymbol = primaryToken?.symbol ?? "TOKEN";
            const cryptoAmountWei = (() => {
                if (!fiatAmount || !Number.isFinite(tokenDecimals))
                    return undefined;
                try {
                    return parseUnits(fiatAmount, tokenDecimals).toString();
                }
                catch {
                    return undefined;
                }
            })();
            if (providerIdTrimmed.length === 0 || !fiatAmount) {
                throw new Error("Transfer amount is required");
            }
            if (!cryptoAmountWei) {
                throw new Error("Failed to compute crypto amount");
            }
            const normalizedProviderId = normalizeRampProviderId(providerIdTrimmed);
            const ieePayload = {
                transfer_type: params.flow,
                provider_id: normalizedProviderId,
                network_id: String(params.networkId),
                account: String(account),
                crypto_symbol: cryptoSymbol,
                fiat_currency: "USD",
                fiat_amount: fiatAmount,
                crypto_amount_wei: cryptoAmountWei,
                payment_method: "account",
            };
            if (tenantId)
                ieePayload.tenant_id = tenantId;
            if (clientId)
                ieePayload.client_id = clientId;
            if (userId)
                ieePayload.user_id = userId;
            try {
                const receiptResult = await iee.run({
                    actionType: "transfer_faucet_execute_v1",
                    payload: ieePayload,
                });
                if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                    throw new Error(receiptResult.status === "cancelled"
                        ? "SafeApprove approval cancelled"
                        : receiptResult.error?.message ?? "SafeApprove approval failed");
                }
                const txHashRaw = receiptResult.transactionHash ?? receiptResult.userOpHash ?? null;
                const txHash = typeof txHashRaw === "string" ? txHashRaw.trim() : "";
                if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
                    throw new Error("SafeApprove approval did not return a valid transaction hash");
                }
                await executeFaucetTransferTx({
                    type: params.flow,
                    providerId: normalizedProviderId,
                    networkId: String(params.networkId),
                    account: String(account),
                    cryptoSymbol,
                    fiatCurrency: "USD",
                    fiatAmount,
                    cryptoAmountWei,
                    paymentMethod: "account",
                    contract: recordContract,
                    metadata: {
                        integrationMethod: "faucet",
                        isFaucet: true,
                        widget: true,
                    },
                    transactionHash: txHash,
                }, { receipt: receiptResult.receipt });
                toastSuccess("Transfer submitted");
                onSuccess?.({ transactionHash: txHash });
                return { transactionHash: txHash };
            }
            catch (err) {
                setErrorText(err instanceof Error ? err.message : "Failed to execute faucet transfer");
                toastError("TransfersCard faucet transfer failed", err, "Failed to execute faucet transfer.");
                throw err instanceof Error ? err : new Error("Failed to execute faucet transfer");
            }
        }
        finally {
            setSubmitting(false);
        }
    }, [
        account,
        clientId,
        executeFaucetTransferTx,
        iee,
        onSuccess,
        primaryToken,
        tenantId,
        userId,
        validateAmount,
    ]);
    const continueWithSafeApprove = useCallback(async () => {
        if (!widget || bypassSubmitting)
            return;
        const currentWidget = widget;
        setWidget(null);
        setBypassSubmitting(true);
        try {
            await executeFaucetTransfer({
                providerId: currentWidget.providerId,
                flow: currentWidget.flow,
                networkId: currentWidget.networkId,
                amountUsd: currentWidget.amountUsd,
            });
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error("Action failed");
            if (onError)
                onError(e);
        }
        finally {
            setBypassSubmitting(false);
        }
    }, [bypassSubmitting, executeFaucetTransfer, onError, widget]);
    const handleSubmit = useCallback(async () => {
        if (!selectedProvider)
            return;
        if (!account) {
            const e = new Error("Sign in to use transfer features");
            if (onError)
                onError(e);
            else
                toastError("TransfersCard submit blocked (not signed in)", e, "Please sign in to continue.");
            return;
        }
        setErrorText(null);
        const validationError = validateAmount();
        if (validationError) {
            setErrorText(validationError);
            return;
        }
        onStart?.(selectedProvider?.id ?? selectedProvider?.providerId);
        // Non-faucet providers: open website url if present
        if (!isFaucet) {
            const url = selectedProvider?.websiteUrl ?? selectedProvider?.metadata?.websiteUrl ?? selectedProvider?.metadata?.url;
            if (typeof url === "string" && url.length > 0) {
                window.open(url, "_blank", "noopener,noreferrer");
                return;
            }
            const e = new Error("Provider URL is not configured");
            if (onError)
                onError(e);
            else
                toastError("TransfersCard provider missing URL", e, "This provider is not configured.");
            return;
        }
        const networkIdRaw = (selectedProvider?.networkId ??
            selectedProvider?.metadata?.networkId ??
            selectedProvider?.metadata?.network_id ??
            selectedProvider?.supportedNetworks?.[0]?.networkId ??
            network?.networkId ??
            network?.id ??
            primaryToken?.networkId);
        const networkId = networkIdRaw !== undefined && networkIdRaw !== null
            ? Number(networkIdRaw)
            : NaN;
        if (!Number.isFinite(networkId)) {
            const e = new Error("No network configured");
            if (onError)
                onError(e);
            else
                toastError("TransfersCard networkId missing", e, "No network configured.");
            return;
        }
        try {
            const providerId = String(selectedProvider?.providerId ??
                selectedProvider?.id ??
                selectedProvider?.metadata?.providerId ??
                selectedProvider?.metadata?.provider_id ??
                "").trim();
            if (!providerId) {
                throw new Error("Provider is not configured");
            }
            await executeFaucetTransfer({
                providerId,
                flow,
                networkId,
                amountUsd: String(amountInput || "").trim(),
            });
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error("Action failed");
            setErrorText(e.message || "Action failed");
            if (onError)
                onError(e);
            else
                toastError("TransfersCard submit failed", e, "Action failed. Please try again.");
        }
    }, [
        selectedProvider,
        account,
        validateAmount,
        onStart,
        isFaucet,
        network,
        flow,
        primaryToken,
        amountInput,
        onSuccess,
        onError,
        executeFaucetTransfer,
    ]);
    useEffect(() => {
        if (!widget)
            return;
        const handler = async (event) => {
            if (!widget)
                return;
            if (event.origin !== widget.widgetOrigin)
                return;
            if (event.source !== iframeRef.current?.contentWindow)
                return;
            let msg = null;
            try {
                msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
            }
            catch {
                return;
            }
            if (!msg || msg.xkova !== "transfer-provider-widget" || msg.version !== 1)
                return;
            if (String(msg.sessionId || "") !== widget.sessionId)
                return;
            if (msg.type === "ready") {
                setWidgetReady(true);
                setWidgetTimedOut(false);
                const amountLabel = widget.amountUsd ? `$${widget.amountUsd} USD` : null;
                postToWidget({
                    type: "init",
                    payload: {
                        providerId: widget.providerId,
                        flow: widget.flow,
                        account: account ?? "",
                        email: user?.email ?? null,
                        networkId: widget.networkId,
                        networkName: network?.name ?? null,
                        amountLabel,
                    },
                });
                return;
            }
            if (msg.type === "cancel") {
                setWidget(null);
                return;
            }
            if (msg.type === "resize") {
                const height = msg.payload?.height;
                if (typeof height === "number" && height > 0 && iframeRef.current) {
                    iframeRef.current.style.height = `${height}px`;
                }
                return;
            }
            if (msg.type === "submit") {
                try {
                    postToWidget({ type: "progress", payload: { message: "Opening approval…" } });
                    const tx = await executeFaucetTransfer({
                        providerId: widget.providerId,
                        flow: widget.flow,
                        networkId: widget.networkId,
                        amountUsd: widget.amountUsd,
                    });
                    postToWidget({
                        type: "result",
                        payload: {
                            ok: true,
                            message: tx?.transactionHash ? `Submitted: ${tx.transactionHash}` : "Submitted",
                            transactionHash: tx?.transactionHash ?? null,
                        },
                    });
                    setWidget(null);
                }
                catch (err) {
                    const e = err instanceof Error ? err : new Error("Action failed");
                    if (onError)
                        onError(e);
                    postToWidget({ type: "result", payload: { ok: false, message: e.message || "Failed" } });
                }
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [account, executeFaucetTransfer, network, onError, postToWidget, user?.email, widget]);
    const loading = configLoading || accountLoading;
    const hasTransferData = Boolean(account) || transferProviders.length > 0;
    const { isInitialLoading, isRefreshing } = useRefreshState(loading, hasTransferData);
    if (isInitialLoading) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-16 w-full" })] })] }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Droplets, { className: "h-5 w-5" }), "Transfers"] }), description: _jsx(CardDescription, { children: "Deposit or withdraw funds." }), actions: isRefreshing ? (_jsx(RefreshCw, { className: "h-4 w-4 animate-spin text-muted-foreground", "aria-label": "Refreshing" })) : null }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx(Dialog, { open: Boolean(widget), onOpenChange: (open) => {
                            if (!open) {
                                setWidget(null);
                                setWidgetReady(false);
                                setWidgetTimedOut(false);
                            }
                        }, children: _jsxs(DialogPortal, { children: [_jsx(DialogOverlay, { className: "bg-black/80" }), _jsxs(DialogPrimitive.Content, { className: "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[34rem] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-3 shadow-2xl", children: [_jsx(DialogPrimitive.Title, { className: "sr-only", children: selectedProvider?.name ?? "Transfer provider" }), _jsx(DialogPrimitive.Description, { className: "sr-only", children: "Hosted transfer provider widget" }), widget && (_jsxs("div", { className: "space-y-3", children: [!widgetReady && (_jsxs("div", { className: "flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground", children: [_jsx(Loader2, { className: `h-3.5 w-3.5 ${widgetTimedOut ? "" : "animate-spin"}` }), _jsx("span", { children: widgetTimedOut
                                                                ? "Widget loading is taking longer than expected."
                                                                : "Loading transfer provider widget..." })] })), widgetTimedOut && (_jsx(Button, { size: "sm", variant: "outline", onClick: continueWithSafeApprove, disabled: bypassSubmitting || submitting, children: bypassSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), "Continuing..."] })) : ("Continue with SafeApprove") })), _jsx("div", { className: "overflow-hidden rounded-md border border-border/60 bg-background", children: _jsx("iframe", { ref: iframeRef, title: "Transfer provider", src: widget.widgetUrl, referrerPolicy: "no-referrer", className: "w-full border-0 bg-background", style: { background: "transparent" } }) })] }))] })] }) }), _jsxs(Select, { value: flow, onChange: (e) => setFlow(e.target.value), children: [_jsx("option", { value: "deposit", children: "Deposit" }), _jsx("option", { value: "withdraw", children: "Withdraw" })] }), availableProviders.length > 1 && (_jsx(Select, { value: selectedProviderId, onChange: (e) => setSelectedProviderId(e.target.value), children: availableProviders.map((p) => {
                            const id = (p?.id ?? p?.providerId);
                            const name = (p?.name ?? "Provider");
                            if (!id)
                                return null;
                            return (_jsx("option", { value: id, children: name }, id));
                        }) })), availableProviders.length === 0 ? (_jsxs(CardEmptyState, { children: ["No ", flow, " providers available."] })) : selectedProvider ? (_jsxs("div", { className: "space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [selectedProvider.logoUrl ? (_jsx("img", { src: selectedProvider.logoUrl, alt: selectedProvider.name ?? "Provider", className: "h-8 w-8 rounded-full object-cover" })) : (_jsx("div", { className: "h-8 w-8 rounded-full bg-muted flex items-center justify-center", children: _jsx(Droplets, { className: "h-4 w-4" }) })), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-sm truncate", children: selectedProvider.name ?? "Provider" }), _jsx("div", { className: "text-xs text-muted-foreground", children: isFaucet ? "Test account (faucet)" : "External provider" })] })] }), !isFaucet && (_jsxs(Button, { size: "sm", variant: "outline", onClick: handleSubmit, disabled: !account, children: [_jsx(ExternalLink, { className: "h-4 w-4" }), "Open"] }))] }), isFaucet && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Amount (USD)" }), _jsx("input", { className: "h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50", value: amountInput, onChange: (e) => setAmountInput(e.target.value), disabled: Boolean(widget) || submitting || bypassSubmitting, inputMode: "decimal", placeholder: flow === "deposit" ? (maxUsd ? String(maxUsd) : "0.00") : (minUsd ? String(minUsd) : "0.00") }), _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Min: ", formatUsd(minUsd), " \u00B7 Max: ", formatUsd(maxUsd)] }), errorText && (_jsx("div", { className: "text-xs text-red-600", children: errorText }))] }), _jsx(Button, { size: "sm", onClick: handleSubmit, disabled: !account || txLoading || submitting || bypassSubmitting, children: submitting || bypassSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), "Processing..."] })) : flow === "deposit" ? ("Deposit") : ("Withdraw") })] }))] })) : null, !account && (_jsx("div", { className: "text-xs text-muted-foreground text-center", children: "Sign in to use transfers." }))] })] }));
}
