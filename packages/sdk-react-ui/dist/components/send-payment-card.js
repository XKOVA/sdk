"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAccountState, useTenantConfig, useTokenBalance, useIeeReceiptAction, useSubmitSendPayment, useIeeContext } from "@xkova/sdk-react";
import { selectTenantNetwork } from "@xkova/sdk-core";
import { parseUnits } from "viem";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toastSuccess } from "../toast-utils.js";
import { Button } from "./ui/button.js";
import { BalanceText } from "./ui/balance-text.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Select } from "./ui/select.js";
import { Skeleton } from "./ui/skeleton.js";
import { Send, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useRefreshState } from "./use-refresh-state.js";
/**
 * Send payments card.
 *
 * @remarks
 * Purpose:
 * - Provide a send form that signs and submits transfers from the primary account.
 *
 * When to use:
 * - Use when enabling end users to send payments.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: SendPaymentCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders inline validation and error messages on failure.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Executes client signing and on-chain transfers.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK session.
 *
 * Data/auth references:
 * - Receipt-gated: client-side signing is disabled in the public SDK. Use the IEE (SafeApprove) iframe modal to obtain a receipt, then call receipt-gated endpoints with `X-XKOVA-IEE-Receipt`.
 * - The IEE (SafeApprove) approval flow is responsible for signing and returning the transaction hash.
 * - The IEE (SafeApprove) approval flow may also return canonical send-payment fields when resolving email recipients server-side.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <SendPaymentCard includeNative onSuccess={(tx) => void tx} />
 */
export function SendPaymentCard({ allowedTokens, defaultTokenContract, includeNative = false, debug = false, defaultRecipient, onSuccess, onError }) {
    const { tokens, networks, isLoading: configLoading } = useTenantConfig();
    const { account, isLoading: accountLoading } = useAccountState();
    const iee = useIeeReceiptAction();
    const { tenantId, clientId, userId } = useIeeContext();
    const { submit: submitSendPayment } = useSubmitSendPayment();
    const logDebug = useCallback((message, details) => {
        if (!debug)
            return;
        try {
            if (details) {
                console.info(`[SendPaymentCard] ${message}`, details);
            }
            else {
                console.info(`[SendPaymentCard] ${message}`);
            }
        }
        catch {
            // Ignore logging failures in browser runtimes.
        }
    }, [debug]);
    const [recipient, setRecipient] = useState(() => defaultRecipient ?? "");
    const [amount, setAmount] = useState("");
    const [selectedContract, setSelectedContract] = useState(defaultTokenContract ?? (includeNative ? "native" : ""));
    const [submitError, setSubmitError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isAccountIdentifier = useCallback((value) => /^0x[a-fA-F0-9]{40}$/.test(value.trim()), []);
    const isEmail = useCallback((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), []);
    const network = useMemo(() => {
        try {
            return selectTenantNetwork(networks);
        }
        catch {
            return null;
        }
    }, [networks]);
    const tokenOptions = useMemo(() => {
        const tenantTokens = tokens ?? [];
        if (!allowedTokens)
            return tenantTokens;
        const allowedSet = new Set(allowedTokens
            .map((t) => t.contract?.toLowerCase())
            .filter((v) => Boolean(v)));
        return tenantTokens.filter((t) => {
            const contract = t.contract?.toLowerCase();
            return contract ? allowedSet.has(contract) : false;
        });
    }, [allowedTokens, tokens]);
    const selectableTokenOptions = useMemo(() => tokenOptions.filter((t) => Boolean(t.contract)), [tokenOptions]);
    const showTokenSelect = includeNative || selectableTokenOptions.length > 1;
    // Ensure the selected contract is always valid based on current props/options.
    useEffect(() => {
        const normalizedDefault = defaultTokenContract?.toLowerCase();
        const selectable = selectableTokenOptions.map((t) => (t.contract ?? "").toLowerCase());
        if (normalizedDefault && selectable.includes(normalizedDefault)) {
            setSelectedContract(defaultTokenContract);
            return;
        }
        if (selectedContract === "native") {
            if (!includeNative) {
                // Native not allowed; fallback to first ERC20 if available
                setSelectedContract(selectableTokenOptions[0]?.contract ?? "");
            }
            return;
        }
        if (selectedContract && selectable.includes(selectedContract.toLowerCase())) {
            return;
        }
        if (!showTokenSelect && selectableTokenOptions.length === 1) {
            setSelectedContract(selectableTokenOptions[0].contract ?? "");
            return;
        }
        if (includeNative) {
            setSelectedContract("native");
            return;
        }
        setSelectedContract(selectableTokenOptions[0]?.contract ?? "");
    }, [
        defaultTokenContract,
        includeNative,
        selectableTokenOptions,
        showTokenSelect,
        selectedContract
    ]);
    const senderAccount = useMemo(() => account ?? null, [account]);
    const selectedTokenMeta = useMemo(() => {
        if (selectedContract === "native")
            return null;
        return selectableTokenOptions.find((t) => t.contract?.toLowerCase() === selectedContract.toLowerCase());
    }, [selectedContract, selectableTokenOptions]);
    const { balance, isLoading: balanceLoading } = useTokenBalance({
        account: senderAccount,
        network,
        selectedContract,
        selectedToken: selectedTokenMeta ?? null,
        includeNative,
    });
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setSubmitError(null);
        if (!senderAccount) {
            setSubmitError("No account available");
            return;
        }
        if (!recipient) {
            setSubmitError("Recipient is required");
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            setSubmitError("Amount must be greater than 0");
            return;
        }
        if (!network) {
            setSubmitError("No network configured");
            return;
        }
        const trimmedRecipient = recipient.trim();
        const recipientIsAccount = isAccountIdentifier(trimmedRecipient);
        const recipientIsEmail = isEmail(trimmedRecipient);
        if (!recipientIsAccount && !recipientIsEmail) {
            setSubmitError("Recipient must be an account identifier (0x...) or an email");
            return;
        }
        // Pending payment (email) sends require an ERC20 token (contract uses ERC20 transfer + approve).
        if (recipientIsEmail && selectedContract === "native") {
            setSubmitError("Email sends require an ERC20 token (select a token like USDC)");
            return;
        }
        if (!includeNative && !selectedTokenMeta?.contract) {
            setSubmitError("No tokens configured for this tenant");
            return;
        }
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            let amountWei;
            try {
                amountWei = parseUnits(amount, selectedTokenMeta?.decimals ?? 18).toString();
            }
            catch {
                throw new Error("Invalid amount; enter a numeric value");
            }
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const networkId = String(network?.networkId ?? network?.network_id ?? "");
            if (!networkId) {
                throw new Error("No network configured");
            }
            const resolveContactType = (contact, provided) => {
                if (provided)
                    return provided;
                if (/^0x[a-fA-F0-9]{40}$/.test(contact)) {
                    return "account";
                }
                if (/^\+?\d{6,}$/.test(contact)) {
                    return "phone";
                }
                if (contact.includes("@")) {
                    return "email";
                }
                return "username";
            };
            const resolvedContactType = resolveContactType(trimmedRecipient);
            const isPendingPayment = !recipientIsAccount;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const fingerprint = isPendingPayment
                ? typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
                : undefined;
            const submitPayload = {
                transactionType: "p2p_send",
                amountWei,
                networkId,
                recipientContact: trimmedRecipient,
                recipientAccount: recipientIsAccount ? trimmedRecipient : undefined,
                recipientEmail: recipientIsEmail ? trimmedRecipient : undefined,
                senderAccount: senderAccount ?? undefined,
                contract: selectedContract,
                contactType: resolvedContactType,
                isPendingPayment,
                expiresAt,
                fingerprint,
            };
            const receiptResult = await iee.run({
                actionType: "send_payment_submit_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    transaction_type: submitPayload.transactionType,
                    amount_wei: amountWei,
                    network_id: networkId,
                    token_address: submitPayload.contract,
                    recipient_contact: trimmedRecipient,
                    contact_type: resolvedContactType,
                    recipient_wallet_address: submitPayload.recipientAccount,
                    is_pending_payment: isPendingPayment,
                    expires_at: expiresAt,
                    fingerprint,
                },
            });
            logDebug("SafeApprove result received", {
                status: receiptResult.status,
                actionType: receiptResult.actionType,
                actionHash: receiptResult.actionHash,
                hasReceipt: Boolean(receiptResult.receipt),
                receiptLength: receiptResult.receipt?.length ?? 0,
                transactionHash: receiptResult.transactionHash ?? null,
                userOpHash: receiptResult.userOpHash ?? null,
                resolvedPayload: receiptResult.resolvedPayload ?? null,
                errorCode: receiptResult.error?.code ?? null,
                errorMessage: receiptResult.error?.message ?? null,
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            const resolvedTxHash = receiptResult.transactionHash ?? receiptResult.userOpHash ?? null;
            if (!resolvedTxHash || !/^0x[a-fA-F0-9]{64}$/.test(resolvedTxHash.trim())) {
                logDebug("Invalid transaction hash from SafeApprove", {
                    transactionHash: receiptResult.transactionHash ?? null,
                    userOpHash: receiptResult.userOpHash ?? null,
                });
                throw new Error("SafeApprove approval did not return a valid transaction hash");
            }
            const resolvedPayload = receiptResult.resolvedPayload ?? null;
            const resolvedRecipientWallet = typeof resolvedPayload?.recipient_wallet_address === "string"
                ? String(resolvedPayload.recipient_wallet_address).trim()
                : typeof resolvedPayload?.recipientWalletAddress === "string"
                    ? String(resolvedPayload.recipientWalletAddress).trim()
                    : null;
            const resolvedIsPending = typeof resolvedPayload?.is_pending_payment === "boolean"
                ? Boolean(resolvedPayload.is_pending_payment)
                : typeof resolvedPayload?.isPendingPayment === "boolean"
                    ? Boolean(resolvedPayload.isPendingPayment)
                    : null;
            const resolvedExpiresAt = typeof resolvedPayload?.expires_at === "string"
                ? String(resolvedPayload.expires_at).trim()
                : typeof resolvedPayload?.expiresAt === "string"
                    ? String(resolvedPayload.expiresAt).trim()
                    : null;
            const finalPayload = {
                ...submitPayload,
                recipientAccount: resolvedRecipientWallet || submitPayload.recipientAccount,
                isPendingPayment: typeof resolvedIsPending === "boolean" ? resolvedIsPending : submitPayload.isPendingPayment,
                expiresAt: resolvedExpiresAt || submitPayload.expiresAt,
            };
            logDebug("Submitting send payment", {
                transactionHash: resolvedTxHash.trim(),
                hasReceipt: Boolean(receiptResult.receipt),
            });
            await submitSendPayment({ ...finalPayload, transactionHash: resolvedTxHash.trim() }, { receipt: receiptResult.receipt });
            logDebug("Send payment submitted", { transactionHash: resolvedTxHash.trim() });
            toastSuccess("Payment submitted");
            onSuccess?.({ transactionHash: resolvedTxHash.trim() });
            setAmount("");
            setRecipient(defaultRecipient ?? "");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to submit payment";
            logDebug("Send payment flow failed", { message });
            setSubmitError(message);
            onError?.(err);
        }
        finally {
            setIsSubmitting(false);
        }
    }, [
        senderAccount,
        recipient,
        amount,
        network,
        selectedTokenMeta,
        selectedContract,
        tenantId,
        clientId,
        userId,
        isAccountIdentifier,
        isEmail,
        onSuccess,
        onError,
        defaultRecipient,
        iee,
        submitSendPayment,
        logDebug
    ]);
    const { isInitialLoading, isRefreshing } = useRefreshState(configLoading || accountLoading, Boolean(network));
    const displayError = submitError;
    if (isInitialLoading) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(Skeleton, { className: "h-6 w-32" }), _jsx(Skeleton, { className: "h-4 w-48 mt-2" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" })] })] }));
    }
    if (!network) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Send, { className: "h-5 w-5" }), "Send"] }), description: _jsx(CardDescription, { children: "Send tokens to another account or email." }) }) }), _jsx(CardContent, { children: _jsx(CardEmptyState, { children: "No network configured for this tenant." }) })] }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Send, { className: "h-5 w-5" }), "Send"] }), description: _jsx(CardDescription, { children: "Send tokens to another account or email." }), actions: isRefreshing ? (_jsx(RefreshCw, { className: "h-4 w-4 animate-spin text-muted-foreground", "aria-label": "Refreshing" })) : null }) }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [displayError && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2", children: [_jsx(AlertCircle, { className: "h-4 w-4 shrink-0" }), displayError] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "recipient", children: "Recipient" }), _jsx(Input, { id: "recipient", type: "text", placeholder: "0x... or recipient@example.com", value: recipient, onChange: (e) => setRecipient(e.target.value), disabled: isSubmitting || !senderAccount })] }), _jsxs("div", { className: showTokenSelect ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "amount", children: "Amount" }), _jsx(Input, { id: "amount", type: "number", step: "any", min: "0", placeholder: "0.00", value: amount, onChange: (e) => setAmount(e.target.value), disabled: isSubmitting || !senderAccount }), _jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [_jsx("span", { children: "Balance" }), balanceLoading ? (_jsx(Skeleton, { className: "h-4 w-24" })) : balance ? (_jsx(BalanceText, { value: balance.value, decimals: balance.decimals, symbol: balance.symbol, isStable: balance.isStable, logoUrl: balance.logoUrl, showSymbol: false, showLogo: true, className: "text-foreground" })) : (_jsx("span", { className: "text-foreground", children: "-" }))] })] }), showTokenSelect ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "token", children: "Token" }), _jsxs(Select, { id: "token", value: selectedContract, onChange: (e) => setSelectedContract(e.target.value), disabled: isSubmitting || !senderAccount, children: [includeNative && _jsx("option", { value: "native", children: network.symbol ?? "Native" }), selectableTokenOptions.map((token) => (_jsx("option", { value: token.contract ?? "", children: token.symbol }, token.contract)))] })] })) : null] }), _jsx(Button, { type: "submit", className: "w-full", disabled: isSubmitting || !senderAccount || !recipient || !amount, children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), "Submitting..."] })) : (_jsxs(_Fragment, { children: [_jsx(Send, { className: "h-4 w-4" }), "Send"] })) }), !senderAccount && (_jsx("div", { className: "text-xs text-muted-foreground text-center", children: "Sign in to send tokens." }))] }) })] }));
}
