"use client";

import {
  usePendingPaymentRequestsInbox,
  usePayPendingPaymentRequest,
  useIeeReceiptAction,
  useIeeContext,
  useTenantConfig,
  normalizeTenantAuthBaseUrl,
} from "@xkova/sdk-react";
import { useCallback, useState } from "react";
import { Inbox, Loader2, RefreshCw, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Button } from "./ui/button.js";
import { toastError, toastSuccess } from "../toast-utils.js";

export interface PendingPaymentRequestsInboxProps {
  /** Optional className for layout spacing. */
  className?: string;
  /** Optional request type filter ("P2P" | "BUSINESS"). */
  type?: "P2P" | "BUSINESS";
  /** Optional auto-refresh interval in ms. */
  autoRefreshMs?: number;
  /** Pay flow mode ("hosted" opens the hosted pay URL; "in-app" uses the SDK hook). */
  payMode?: "hosted" | "in-app";
  /** Transaction type to use for the in-app send-payment step (required for `payMode="in-app"`). */
  sendTransactionType?: string;
}

const formatAmount = (r: any) => {
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

const formatDate = (timestamp?: string) => {
  if (!timestamp) return "-";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "-";
  }
};

const buildPayUrlFromBaseUrl = (baseUrl: string, publicToken: string) => {
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
export function PendingPaymentRequestsInbox({
  className,
  type = "P2P",
  autoRefreshMs,
  payMode = "hosted",
  sendTransactionType,
}: PendingPaymentRequestsInboxProps) {
  const { requests, isLoading, error, refetch, decline } =
    usePendingPaymentRequestsInbox({
      type,
      autoRefreshMs,
    });
  const { pay } = usePayPendingPaymentRequest();
  const { tenant } = useTenantConfig();
  const iee = useIeeReceiptAction();
  const { tenantId, clientId, userId } = useIeeContext();
  const authBaseUrl = normalizeTenantAuthBaseUrl((tenant as any)?.authDomain);
  const [payingId, setPayingId] = useState<string | null>(null);

  const handleDecline = useCallback(
    async (requestId: string) => {
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
          throw new Error(
            receiptResult.status === "cancelled"
              ? "SafeApprove approval cancelled"
              : receiptResult.error?.message ?? "SafeApprove approval failed",
          );
        }

        await decline(requestId, { receipt: receiptResult.receipt });
        toastSuccess("Payment request declined");
        refetch();
      } catch (err) {
        toastError("Decline payment request", err, "Failed to decline payment request");
      }
    },
    [clientId, decline, iee, refetch, tenantId, userId],
  );

  const handlePay = useCallback(async (request: any) => {
    if (payMode === "hosted") {
      const publicToken = request?.publicToken ?? null;
      if (!publicToken) return;
      if (!authBaseUrl) return;
      const payUrl = buildPayUrlFromBaseUrl(authBaseUrl, publicToken);
      window.open(payUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!sendTransactionType) {
      toastError(
        "Pay payment request",
        new Error("sendTransactionType is required for in-app pay"),
        "Missing send transaction type",
      );
      return;
    }

    const requestKey = String(request?.id ?? request?.requestId ?? "").trim();
    setPayingId(requestKey || "paying");
    try {
      await pay(request, { sendTransactionType });
      toastSuccess("Payment submitted");
      refetch();
    } catch (err) {
      toastError("Pay payment request", err, "Failed to pay payment request");
    } finally {
      setPayingId(null);
    }
  }, [authBaseUrl, pay, payMode, refetch, sendTransactionType]);

  if (isLoading && requests.length === 0) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
            Loading pending requests...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {String(error?.message || "Failed to load pending requests")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!requests.length) return null;

  return (
    <div className={className}>
      <Card>
        <CardHeader className="space-y-3">
          <CardHeaderRow
            title={
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-5" />
                Pending Requests
              </CardTitle>
            }
            actions={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            }
          />
          <CardDescription>
            {requests.length} request{requests.length !== 1 ? "s" : ""} waiting for your action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((req: any) => (
            <div
              key={req.id ?? req.requestId}
              className="rounded-lg border border-border/60 p-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {req.requesterEmail ?? "Requestor"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(req.createdAt)} · {req.status}
                  </div>
                  {req.description ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {req.description}
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {formatAmount(req)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {(() => {
                  const requestKey = String(req.id ?? req.requestId ?? "").trim();
                  const isPaying = payingId === requestKey && requestKey.length > 0;
                  const payDisabled = payMode === "hosted"
                    ? !req.publicToken || !authBaseUrl
                    : !sendTransactionType || Boolean(payingId);
                  const declineDisabled = Boolean(payingId);

                  return (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handlePay(req)}
                        disabled={payDisabled}
                      >
                        {isPaying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        {!isPaying && payMode === "hosted" ? (
                          <ExternalLink className="mr-2 size-4" />
                        ) : null}
                        {isPaying ? "Paying..." : "Pay"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={declineDisabled}
                        onClick={() => handleDecline(String(req.id ?? req.requestId))}
                      >
                        <X className="mr-2 size-4" />
                        Decline
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
