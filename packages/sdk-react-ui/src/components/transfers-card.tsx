"use client";

import {
  useAccountState,
  useTenantConfig,
  useExecuteFaucetTransfer,
  useIeeReceiptAction,
  useIeeContext,
  useAuth,
} from "@xkova/sdk-react";
import { selectTenantNetwork, TokenAsset } from "@xkova/sdk-core";
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

type TransferFlow = "deposit" | "withdraw";

const toNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const formatUsd = (v: number | null | undefined): string => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "Not specified";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
};

const selectPrimaryToken = (tokens: TokenAsset[]): TokenAsset | null =>
  tokens.find((t) => t.isPrimary || t.isDefault) ?? tokens[0] ?? null;

const normalizeRampProviderId = (providerId: string): string => {
  const trimmed = providerId.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "faucet" || lower === "usdc_faucet") return "usdc-faucet";
  return trimmed;
};

/**
 * Props for {@link TransfersCard}.
 *
 * @remarks
 * Purpose:
 * - Configure callbacks for transfer flow lifecycle events.
 *
 * When to use:
 * - Use when embedding transfers UI and you need lifecycle hooks.
 *
 * When not to use:
 * - Do not pass sensitive data into callbacks.
 *
 * Return semantics:
 * - Props type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Callbacks are optional and should be safe to call multiple times.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react transfer hooks.
 */
export interface TransfersCardProps {
  /** Callback when transfer flow starts */
  onStart?: (providerId: string | undefined) => void;
  /** Callback when faucet claim succeeds */
  onSuccess?: (tx: { transactionHash?: string }) => void;
  /** Callback when action fails */
  onError?: (error: Error) => void;
}

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
export function TransfersCard({ onStart, onSuccess, onError }: TransfersCardProps) {
  const { transferProviders, networks, tokens, isLoading: configLoading } = useTenantConfig();
  const { account, isLoading: accountLoading } = useAccountState();
  const { user } = useAuth();
  const iee = useIeeReceiptAction();
  const { tenantId, clientId, userId } = useIeeContext();
  const txLoading = false;
  const { execute: executeFaucetTransferTx } = useExecuteFaucetTransfer();
  const [flow, setFlow] = useState<TransferFlow>("deposit");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [widget, setWidget] = useState<{
    sessionId: string;
    widgetUrl: string;
    widgetOrigin: string;
    providerId: string;
    flow: TransferFlow;
    faucetContract: string;
    networkId: number;
    amountUsd: string;
  } | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetTimedOut, setWidgetTimedOut] = useState(false);
  const [bypassSubmitting, setBypassSubmitting] = useState(false);

  const network = useMemo(() => {
    try {
      return selectTenantNetwork(networks);
    } catch {
      return null;
    }
  }, [networks]);

  const primaryToken = useMemo(() => selectPrimaryToken(tokens ?? []), [tokens]);

  const availableProviders = useMemo(() => {
    const list = transferProviders ?? [];
    const wants = flow === "deposit" ? ["deposit"] : ["withdraw"];
    return list.filter((p: any) => {
      const supported = (p?.supportedTypes ?? p?.metadata?.supportedTypes ?? p?.metadata?.supported_types) as any;
      const arr = Array.isArray(supported) ? supported : [];
      return arr.some((item) => wants.includes(item));
    });
  }, [transferProviders, flow]);

  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) return availableProviders[0] ?? null;
    return availableProviders.find((p: any) => (p?.id ?? p?.providerId) === selectedProviderId) ?? null;
  }, [availableProviders, selectedProviderId]);

  const isFaucet = Boolean(
    selectedProvider?.faucetContract ?? selectedProvider?.metadata?.faucetContract,
  );

  useEffect(() => {
    if (!widget) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Set legacy transparency without triggering React DOM warnings.
    iframe.setAttribute("allowtransparency", "true");
    
    // Set initial minimum height
    iframe.style.height = '500px';
  }, [widget]);

  useEffect(() => {
    if (!widget || widgetReady) return;
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
      const firstId = (availableProviders[0]?.id ?? availableProviders[0]?.providerId) as string | undefined;
      if (firstId) setSelectedProviderId(firstId);
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

  const validateAmount = useCallback((): string | null => {
    if (!isFaucet) return null;
    const v = toNumber(amountInput);
    if (v === null) return "Enter a valid USD amount";
    if (v <= 0) return "Amount must be greater than 0";
    if (flow === "withdraw" && typeof minUsd === "number" && v < minUsd) {
      return `Minimum is ${formatUsd(minUsd)}`;
    }
    if (flow === "deposit" && typeof maxUsd === "number" && v > maxUsd) {
      return `Maximum is ${formatUsd(maxUsd)}`;
    }
    return null;
  }, [isFaucet, amountInput, flow, minUsd, maxUsd]);

  const postToWidget = useCallback(
    (params: { type: "init" | "progress" | "result"; payload: Record<string, any> }) => {
      if (!widget) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(
          JSON.stringify({
            xkova: "transfer-provider-widget",
            version: 1,
            sessionId: widget.sessionId,
            type: params.type,
            payload: params.payload ?? {},
          }),
          widget.widgetOrigin,
        );
      } catch {
        // ignore
      }
    },
    [widget],
  );

  const executeFaucetTransfer = useCallback(
    async (params: {
      providerId: string;
      flow: TransferFlow;
      networkId: number;
      amountUsd: string;
    }) => {
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
        const fiatAmount =
          typeof fiatAmountNumber === "number" && Number.isFinite(fiatAmountNumber)
            ? fiatAmountNumber.toFixed(2)
            : null;
        const tokenDecimalsRaw = (primaryToken as any)?.decimals;
        const tokenDecimalsParsed = Number(tokenDecimalsRaw);
        const tokenDecimals = Number.isFinite(tokenDecimalsParsed) ? tokenDecimalsParsed : 18;
        const recordContract =
          typeof primaryToken?.contract === "string" && primaryToken.contract.trim().length > 0
            ? primaryToken.contract
            : undefined;
        const cryptoSymbol = primaryToken?.symbol ?? "TOKEN";
        const cryptoAmountWei = (() => {
          if (!fiatAmount || !Number.isFinite(tokenDecimals)) return undefined;
          try {
            return parseUnits(fiatAmount, tokenDecimals).toString();
          } catch {
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
        const ieePayload: Record<string, unknown> = {
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
        if (tenantId) ieePayload.tenant_id = tenantId;
        if (clientId) ieePayload.client_id = clientId;
        if (userId) ieePayload.user_id = userId;

        try {
          const receiptResult = await iee.run({
            actionType: "transfer_faucet_execute_v1",
            payload: ieePayload,
          });

          if (receiptResult.status !== "approved" || !receiptResult.receipt) {
            throw new Error(
              receiptResult.status === "cancelled"
                ? "SafeApprove approval cancelled"
                : receiptResult.error?.message ?? "SafeApprove approval failed",
            );
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
        } catch (err) {
          setErrorText(err instanceof Error ? err.message : "Failed to execute faucet transfer");
          toastError(
            "TransfersCard faucet transfer failed",
            err,
            "Failed to execute faucet transfer.",
          );
          throw err instanceof Error ? err : new Error("Failed to execute faucet transfer");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      account,
      clientId,
      executeFaucetTransferTx,
      iee,
      onSuccess,
      primaryToken,
      tenantId,
      userId,
      validateAmount,
    ],
  );

  const continueWithSafeApprove = useCallback(async () => {
    if (!widget || bypassSubmitting) return;
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
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Action failed");
      if (onError) onError(e);
    } finally {
      setBypassSubmitting(false);
    }
  }, [bypassSubmitting, executeFaucetTransfer, onError, widget]);

  const handleSubmit = useCallback(async () => {
    if (!selectedProvider) return;
    if (!account) {
      const e = new Error("Sign in to use transfer features");
      if (onError) onError(e);
      else toastError("TransfersCard submit blocked (not signed in)", e, "Please sign in to continue.");
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
      if (onError) onError(e);
      else toastError("TransfersCard provider missing URL", e, "This provider is not configured.");
      return;
    }

    const networkIdRaw = (selectedProvider?.networkId ??
      selectedProvider?.metadata?.networkId ??
      selectedProvider?.metadata?.network_id ??
      selectedProvider?.supportedNetworks?.[0]?.networkId ??
      (network as any)?.networkId ??
      (network as any)?.id ??
      (primaryToken as any)?.networkId) as
      | number
      | string
      | undefined;
    const networkId =
      networkIdRaw !== undefined && networkIdRaw !== null
        ? Number(networkIdRaw)
        : NaN;
    if (!Number.isFinite(networkId)) {
      const e = new Error("No network configured");
      if (onError) onError(e);
      else toastError("TransfersCard networkId missing", e, "No network configured.");
      return;
    }

    try {
      const providerId = String(
        selectedProvider?.providerId ??
        selectedProvider?.id ??
        selectedProvider?.metadata?.providerId ??
        selectedProvider?.metadata?.provider_id ??
        "",
      ).trim();
      if (!providerId) {
        throw new Error("Provider is not configured");
      }

      await executeFaucetTransfer({
        providerId,
        flow,
        networkId,
        amountUsd: String(amountInput || "").trim(),
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Action failed");
      setErrorText(e.message || "Action failed");
      if (onError) onError(e);
      else toastError("TransfersCard submit failed", e, "Action failed. Please try again.");
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
    if (!widget) return;
    const handler = async (event: MessageEvent) => {
      if (!widget) return;
      if (event.origin !== widget.widgetOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      let msg: any = null;
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!msg || msg.xkova !== "transfer-provider-widget" || msg.version !== 1) return;
      if (String(msg.sessionId || "") !== widget.sessionId) return;

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
            networkName: (network as any)?.name ?? null,
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
        } catch (err) {
          const e = err instanceof Error ? err : new Error("Action failed");
          if (onError) onError(e);
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
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardHeaderRow
          title={
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Transfers
        </CardTitle>
          }
          description={<CardDescription>Deposit or withdraw funds.</CardDescription>}
          actions={
            isRefreshing ? (
              <RefreshCw
                className="h-4 w-4 animate-spin text-muted-foreground"
                aria-label="Refreshing"
              />
            ) : null
          }
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog
          open={Boolean(widget)}
          onOpenChange={(open) => {
            if (!open) {
              setWidget(null);
              setWidgetReady(false);
              setWidgetTimedOut(false);
            }
          }}
        >
          <DialogPortal>
            <DialogOverlay className="bg-black/80" />
            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[34rem] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-3 shadow-2xl">
              <DialogPrimitive.Title className="sr-only">
                {selectedProvider?.name ?? "Transfer provider"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Hosted transfer provider widget
              </DialogPrimitive.Description>
              {widget && (
                <div className="space-y-3">
                  {!widgetReady && (
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className={`h-3.5 w-3.5 ${widgetTimedOut ? "" : "animate-spin"}`} />
                      <span>
                        {widgetTimedOut
                          ? "Widget loading is taking longer than expected."
                          : "Loading transfer provider widget..."}
                      </span>
                    </div>
                  )}
                  {widgetTimedOut && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={continueWithSafeApprove}
                      disabled={bypassSubmitting || submitting}
                    >
                      {bypassSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Continuing...
                        </>
                      ) : (
                        "Continue with SafeApprove"
                      )}
                    </Button>
                  )}
                  <div className="overflow-hidden rounded-md border border-border/60 bg-background">
                    <iframe
                      ref={iframeRef}
                      title="Transfer provider"
                      src={widget.widgetUrl}
                      referrerPolicy="no-referrer"
                      className="w-full border-0 bg-background"
                      style={{ background: "transparent" }}
                    />
                  </div>
                </div>
              )}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>

        {/* 1) Mode selector: ONLY Deposit/Withdraw */}
        <Select value={flow} onChange={(e) => setFlow(e.target.value as TransferFlow)}>
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
        </Select>

        {/* 2) Provider selector */}
        {availableProviders.length > 1 && (
          <Select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
          >
            {availableProviders.map((p: any) => {
              const id = (p?.id ?? p?.providerId) as string | undefined;
              const name = (p?.name ?? "Provider") as string;
              if (!id) return null;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </Select>
        )}

        {availableProviders.length === 0 ? (
          <CardEmptyState>No {flow} providers available.</CardEmptyState>
        ) : selectedProvider ? (
          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedProvider.logoUrl ? (
                  <img
                    src={selectedProvider.logoUrl}
                    alt={selectedProvider.name ?? "Provider"}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Droplets className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{selectedProvider.name ?? "Provider"}</div>
                  <div className="text-xs text-muted-foreground">
                    {isFaucet ? "Test account (faucet)" : "External provider"}
                  </div>
                </div>
              </div>

              {!isFaucet && (
                <Button size="sm" variant="outline" onClick={handleSubmit} disabled={!account}>
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              )}
            </div>

            {isFaucet && (
              <>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Amount (USD)</div>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    disabled={Boolean(widget) || submitting || bypassSubmitting}
                    inputMode="decimal"
                    placeholder={flow === "deposit" ? (maxUsd ? String(maxUsd) : "0.00") : (minUsd ? String(minUsd) : "0.00")}
                  />
                  <div className="text-xs text-muted-foreground">
                    Min: {formatUsd(minUsd)} · Max: {formatUsd(maxUsd)}
                  </div>
                  {errorText && (
                    <div className="text-xs text-red-600">{errorText}</div>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!account || txLoading || submitting || bypassSubmitting}
                >
                  {submitting || bypassSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : flow === "deposit" ? (
                    "Deposit"
                  ) : (
                    "Withdraw"
                  )}
                </Button>
              </>
            )}
          </div>
        ) : null}

        {!account && (
          <div className="text-xs text-muted-foreground text-center">
            Sign in to use transfers.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
