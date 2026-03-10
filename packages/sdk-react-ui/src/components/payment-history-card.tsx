"use client";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog.js";
import { SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue } from "./ui/select-menu.js";

/**
 * Props for {@link PaymentHistoryCard}.
 *
 * @remarks
 * Purpose:
 * - Configure toast handling for payment history UI.
 *
 * When to use:
 * - Use to supply a custom toast handler.
 *
 * When not to use:
 * - Do not pass sensitive data into toast handlers.
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
 * - Toast handler should be fast and non-throwing.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react send payment history hooks.
 */
export interface PaymentHistoryCardProps {
  onToast?: (type: "success" | "error" | "info", message: string) => void;
}

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
export function PaymentHistoryCard({ onToast }: PaymentHistoryCardProps) {
  const notify = (type: "success" | "error" | "info", message: string, err?: unknown) => {
    notifyToast(type, message, {
      onToast,
      ...(type === "error" ? { error: err, context: "PaymentHistoryCard", fallbackForError: "Action failed. Please try again." } : {}),
    });
  };
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const { networks } = useTenantConfig();
  const { tenantId, clientId, userId } = useIeeContext();

  const offset = pageIndex * pageSize;
  const effectiveStatus = statusFilter === "all" ? undefined : statusFilter;

  const paymentFilter = useMemo(
    () => ({
      status: effectiveStatus,
      // Fetch 1 extra row so we can enable/disable "Next" without needing a total count.
      limit: pageSize + 1,
      offset,
    }),
    [effectiveStatus, pageSize, offset],
  );

  const { payments, isLoading, refetch } = useSendPaymentHistory(paymentFilter);
  const { isInitialLoading, isRefreshing } = useRefreshState(
    isLoading,
    (payments?.length ?? 0) > 0,
  );
  const iee = useIeeReceiptAction();
  const { remind: remindSendPayment, isLoading: isReminding } = useRemindSendPayment();
  const { cancelOnchain, isLoading: isOnchainCancelling } = useCancelPendingPaymentOnchain();
  const [paymentToCancel, setPaymentToCancel] = useState<any>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [onchainCancellingId, setOnchainCancellingId] = useState<string | null>(null);

  const canPrev = pageIndex > 0;
  const hasNext = (payments?.length ?? 0) > pageSize;
  const canNext = hasNext;
  const pagePayments = (payments ?? []).slice(0, pageSize);

  const formatAmount = (payment: any) => {
    const decimals = Number(payment.tokenDecimals ?? 18);
    const amountWei = typeof payment.amountWei === "string" ? payment.amountWei : String(payment.amountWei ?? "0");
    const amount = BigInt(amountWei);
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
    return `${whole}.${fractionStr} ${payment.tokenSymbol ?? "TOKEN"}`;
  };

  const getExplorerTxUrl = (networkId: number | string | null | undefined, transactionHash: string | null | undefined) => {
    if (!transactionHash) return null;
    const normalizedNetworkId =
      networkId !== null && networkId !== undefined ? String(networkId) : null;
    const net = networks?.find((n: any) => String(n.networkId) === normalizedNetworkId);
    const explorerBase =
      (net as any)?.explorerUrl ??
      (net as any)?.explorer_url ??
      null;
    if (!explorerBase) return null;
    return `${String(explorerBase).replace(/\/+$/, "")}/tx/${transactionHash}`;
  };

  const formatDate = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "-";
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;

      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            <Clock className="size-3" />
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
            <Check className="size-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="secondary" className="gap-1 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
            <X className="size-3" />
            Failed
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
            <Clock className="size-3" />
            Expired
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="gap-1">
            <X className="size-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRemind = async (payment: any) => {
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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }
      await remindSendPayment(payment.id, { receipt: receiptResult.receipt });

      notify("success", "Reminder sent");
      await refetch();
    } catch (err) {
      notify("error", "Could not send reminder. Please try again.", err);
    } finally {
      setRemindingId(null);
    }
  };

  const handleCancelOnchain = async (payment: any) => {
    setOnchainCancellingId(payment.id);
    try {
      const receiptResult = await iee.run({
        actionType: "send_payment_cancel_onchain_v1",
        payload: {
          payment_transfer_id: payment.id,
        },
      });

      if (receiptResult.status !== "approved" || !receiptResult.receipt) {
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }

      const cancelTxHash =
        receiptResult.transactionHash ?? receiptResult.userOpHash ?? null;
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
    } catch (err) {
      notify("error", "Could not cancel on-chain. Please try again.", err);
    } finally {
      setOnchainCancellingId(null);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardHeaderRow
            title={
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Payment History
            </CardTitle>
            }
            description={<CardDescription>Sent payments across all statuses, including escrowed and completed.</CardDescription>}
            actions={
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <SelectMenu
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPageIndex(0);
              }}
            >
              <SelectMenuTrigger className="h-8 w-[170px]">
                <SelectMenuValue placeholder="Filter status" />
              </SelectMenuTrigger>
                <SelectMenuContent>
                  <SelectMenuItem value="all">All Statuses</SelectMenuItem>
                  <SelectMenuItem value="pending">Pending</SelectMenuItem>
                  <SelectMenuItem value="completed">Completed</SelectMenuItem>
                  <SelectMenuItem value="cancelled">Cancelled</SelectMenuItem>
                  <SelectMenuItem value="failed">Failed</SelectMenuItem>
                  <SelectMenuItem value="expired">Expired</SelectMenuItem>
                </SelectMenuContent>
            </SelectMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => refetch()}
                    disabled={isRefreshing}
                    aria-label="Refresh"
                  >
                    <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
            }
          />
        </CardHeader>

        <CardContent className="flex flex-col gap-4 flex-1 min-h-0">
          {isInitialLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : pagePayments && pagePayments.length > 0 ? (
            <>
              <div className="space-y-3 sm:hidden">
                {pagePayments.map((payment: any) => {
                  const txUrl = getExplorerTxUrl(payment.networkId, payment.transactionHash);
                  const isRowReminding = remindingId === payment.id || isReminding;
                  const isRowOnchainCancelling = onchainCancellingId === payment.id || isOnchainCancelling;
                  const canRemind = payment.status === "pending" && payment.isPendingPayment && payment.contactType === "email";
                  const canCancelOnchain = payment.status === "pending" && payment.isPendingPayment;

                  return (
                    <div key={payment.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Recipient</div>
                          <div className="font-medium break-words">{payment.recipientContact ?? "-"}</div>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{formatAmount(payment)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</span>
                      </div>

                      <div className="text-sm">
                        {txUrl ? (
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View TX
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No tx link</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {canCancelOnchain ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentToCancel(payment)}
                            disabled={isRowOnchainCancelling || isRowReminding}
                            className="h-8 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                          >
                            {isRowOnchainCancelling ? (
                              <>
                                <RefreshCw className="size-3 mr-1 animate-spin" />
                                Cancelling
                              </>
                            ) : (
                              <>
                                <X className="size-3 mr-1" />
                                Cancel
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No cancel action</span>
                        )}
                        {canRemind ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemind(payment)}
                            disabled={isRowReminding || isRowOnchainCancelling}
                            className="h-8"
                          >
                            {isRowReminding ? (
                              <>
                                <RefreshCw className="size-3 mr-1 animate-spin" />
                                Sending
                              </>
                            ) : (
                              <>
                                <Bell className="size-3 mr-1" />
                                Remind
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block rounded-md border flex-1 min-h-0 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>TX</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagePayments.map((payment: any) => {
                      const txUrl = getExplorerTxUrl(payment.networkId, payment.transactionHash);
                      const isRowReminding = remindingId === payment.id || isReminding;
                      const isRowOnchainCancelling = onchainCancellingId === payment.id || isOnchainCancelling;
                      const canRemind = payment.status === "pending" && payment.isPendingPayment && payment.contactType === "email";
                      const canCancelOnchain = payment.status === "pending" && payment.isPendingPayment;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="max-w-[240px] truncate font-medium">
                            {payment.recipientContact ?? "-"}
                          </TableCell>
                          <TableCell className="sm:whitespace-nowrap">{formatAmount(payment)}</TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="sm:whitespace-nowrap">{formatDate(payment.createdAt)}</TableCell>
                          <TableCell className="sm:whitespace-nowrap">
                            {txUrl ? (
                              <a
                                href={txUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                View
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-2">
                              {canCancelOnchain ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPaymentToCancel(payment)}
                                  disabled={isRowOnchainCancelling || isRowReminding}
                                  className="h-8 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                                >
                                  {isRowOnchainCancelling ? (
                                    <>
                                      <RefreshCw className="size-3 mr-1 animate-spin" />
                                      Cancelling
                                    </>
                                  ) : (
                                    <>
                                      <X className="size-3 mr-1" />
                                      Cancel
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                              {canRemind ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemind(payment)}
                                  disabled={isRowReminding || isRowOnchainCancelling}
                                  className="h-8"
                                >
                                  {isRowReminding ? (
                                    <>
                                      <RefreshCw className="size-3 mr-1 animate-spin" />
                                      Sending
                                    </>
                                  ) : (
                                    <>
                                      <Bell className="size-3 mr-1" />
                                      Remind
                                    </>
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Page {pageIndex + 1}
                </div>
                <div className="flex items-center gap-2">
                  <SelectMenu
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPageIndex(0);
                    }}
                  >
                    <SelectMenuTrigger className="h-8 w-[120px]">
                      <SelectMenuValue placeholder="Rows" />
                    </SelectMenuTrigger>
                    <SelectMenuContent>
                      <SelectMenuItem value="10">10 / page</SelectMenuItem>
                      <SelectMenuItem value="20">20 / page</SelectMenuItem>
                      <SelectMenuItem value="50">50 / page</SelectMenuItem>
                    </SelectMenuContent>
                  </SelectMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={!canPrev}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex((p) => p + 1)}
                    disabled={!canNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-10 space-y-2">
              <Shield className="size-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No payment history found
                {statusFilter !== "all" && ` with status "${statusFilter}"`}
              </p>
              <p className="text-xs text-muted-foreground">
                Send a payment to see it here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(paymentToCancel)} onOpenChange={(open: boolean) => !open && setPaymentToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-red-500" />
              Cancel Pending Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this payment to{" "}
              <span className="font-semibold">{paymentToCancel?.recipientContact}</span>
              {paymentToCancel && (
                <>
                  {" "}for{" "}
                  <span className="font-semibold">{formatAmount(paymentToCancel)}</span>
                </>
              )}
              ?
              <br /><br />
              The funds will be returned to your account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isOnchainCancelling || Boolean(onchainCancellingId)}>
              Keep Payment
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleCancelOnchain(paymentToCancel)}
              disabled={isOnchainCancelling || Boolean(onchainCancellingId)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isOnchainCancelling || onchainCancellingId ? "Cancelling..." : "Yes, Cancel Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
