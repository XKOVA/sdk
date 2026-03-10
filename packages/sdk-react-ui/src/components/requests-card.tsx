"use client";

import {
  useCreatePaymentRequest,
  useIncomingPaymentRequestHistory,
  useOutgoingPaymentRequestHistory,
  useCancelPaymentRequest,
  useDeclinePaymentRequest,
  useRemindPaymentRequest,
  useTenantConfig,
  useIeeReceiptAction,
  useIeeContext,
  useAccountState,
} from "@xkova/sdk-react";
import { Mail, Inbox, Send, Copy, RefreshCw, Loader2, AlertCircle, Link as LinkIcon, X, XCircle, Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
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

const buildPayUrlFromBaseUrl = (baseUrl: string, publicToken: string) => {
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/pay/${encodeURIComponent(publicToken)}`;
};

const normalizeTenantAuthBaseUrl = (authDomain: string | null | undefined) => {
  const raw = String(authDomain ?? "").trim();
  if (!raw) return null;

  // Prefer a caller-supplied absolute URL.
  if (raw.includes("://")) {
    try {
      return new URL(raw).origin;
    } catch {
      return raw.replace(/\/$/, "");
    }
  }

  // Use the current protocol when available (helps localhost/http dev),
  // but default to https for tenant domains.
  const protocol =
    typeof window !== "undefined" && window.location?.protocol
      ? window.location.protocol
      : "https:";

  return `${protocol}//${raw}`;
};

const copyText = async (text: string) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toastSuccess("Copied");
      return;
    }
  } catch (_) { }
  // Fallback
  if (typeof document === "undefined") return;
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

const getStatusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (s === "completed") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">Completed</Badge>;
  if (s === "declined") return <Badge variant="outline">Declined</Badge>;
  if (s === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  if (s === "expired") return <Badge variant="outline">Expired</Badge>;
  if (s === "failed") return <Badge variant="outline">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

/**
 * Props for {@link RequestPaymentCard}.
 *
 * @remarks
 * Purpose:
 * - Configure the request form defaults.
 *
 * When to use:
 * - Use to pre-fill payer email for "request payment" shortcuts.
 *
 * When not to use:
 * - Do not pass untrusted values without validation.
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
 * - `defaultPayerEmail` should be an email when provided.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react payment request hooks.
 */
export interface RequestPaymentCardProps {
  /**
   * Default payer email to pre-fill the form.
   *
   * @remarks
   * - Useful for “Receive” shortcuts from a contacts list.
   * - When provided, the input is initialized to this value and resets to it after a successful request.
   */
  defaultPayerEmail?: string;
}

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
export function RequestPaymentCard({ defaultPayerEmail }: RequestPaymentCardProps) {
  const { create, isLoading: creating } = useCreatePaymentRequest();
  const { tokens, tenant, networks } = useTenantConfig();
  const { account } = useAccountState();
  const { tenantId, clientId, userId } = useIeeContext();
  const iee = useIeeReceiptAction();

  const [payerEmail, setPayerEmail] = useState(() => defaultPayerEmail ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<any>(null);

  const primaryTokenSymbol = useMemo(() => {
    const list = tokens ?? [];
    const primary =
      (list as any[]).find((t) => Boolean((t as any)?.isPrimary)) ??
      (list as any[]).find((t) => Boolean((t as any)?.isDefault)) ??
      (list as any[])[0] ??
      null;
    const sym = String((primary as any)?.symbol || "").trim();
    return sym || "USDC";
  }, [tokens]);

  const authBaseUrl = useMemo(() => normalizeTenantAuthBaseUrl(tenant?.authDomain), [tenant?.authDomain]);
  const buildPayUrl = useCallback((publicToken: string) => {
    if (!authBaseUrl) return "";
    return buildPayUrlFromBaseUrl(authBaseUrl, publicToken);
  }, [authBaseUrl]);

  const onSubmit = useCallback(async (e: FormEvent) => {
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

      const primaryToken =
        (tokens || []).find((t: any) => (t as any).isPrimary) ??
        (tokens || []).find((t: any) => (t as any).isDefault) ??
        (tokens || [])[0] ??
        null;
      const decimals = Number((primaryToken as any)?.decimals ?? 18);

      const amountRaw = String(amount || "").trim();
      if (!amountRaw || Number(amountRaw) <= 0) {
        throw new Error("amount must be > 0");
      }
      let amountWei: string;
      try {
        amountWei = parseUnits(amountRaw, decimals).toString();
      } catch {
        throw new Error("Invalid amount; enter a numeric value");
      }

      const networkId =
        (networks || []).find((n: any) => n?.networkId)?.networkId ??
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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }

      const created = await create(
        {
          payerEmail: trimmedEmail,
          amount: amountRaw,
          description,
          expiresAt,
          requestorAccount,
          networkId: String(networkId),
        },
        { receipt: receiptResult.receipt },
      );
      setLastCreated(created);
      setPayerEmail(defaultPayerEmail ?? "");
      setAmount("");
      setNote("");
      // Let other cards react without direct coupling.
      window.dispatchEvent(
        new CustomEvent(REQUEST_CREATED_EVENT, {
          detail: { requestId: created?.requestId, publicToken: created?.publicToken },
        }),
      );
    } catch (err) {
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

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="h-full flex flex-col">
        <CardHeader className="space-y-4">
          <CardHeaderRow
            title={
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-5" />
                Request
              </CardTitle>
            }
          />
          <CardDescription>
            Request money by email, then share a hosted pay link.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <form className="space-y-4" onSubmit={onSubmit}>
          {/* Payer email (line 1) */}
          <div className="space-y-2">
            <Label htmlFor="payerEmail">Payer email</Label>
            <Input
              id="payerEmail"
              placeholder="payer@example.com"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
            />
          </div>

          {/* Amount (line 2) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <div className="text-xs text-muted-foreground">
                Token: <span className="font-medium text-foreground">{primaryTokenSymbol}</span>
              </div>
            </div>
            <Input
              id="amount"
              placeholder="10.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Note (line 3) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="note">Note (optional)</Label>
              <div className="text-xs text-muted-foreground">
                {note.length}/200
              </div>
            </div>
            <textarea
              id="note"
              placeholder="What is this for?"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="flex min-h-[80px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {submitError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 text-destructive" />
              <div className="text-destructive">{submitError}</div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Create request
            </Button>
          </div>
        </form>

        {lastCreated?.publicToken ? (
          <div className="mt-4 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="size-4 text-muted-foreground" />
                <span className="font-medium">Pay link ready</span>
                {lastCreated?.payerEmail ? (
                  <span className="text-muted-foreground">
                    (sent to <span className="font-medium text-foreground">{String(lastCreated.payerEmail)}</span>)
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => copyText(buildPayUrl(lastCreated.publicToken))}
                        disabled={!authBaseUrl}
                        aria-label="Copy pay link"
                      >
                        <Copy />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Copy pay link</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        ) : null}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
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
  const buildPayUrl = useCallback((publicToken: string) => {
    if (!authBaseUrl) return "";
    return buildPayUrlFromBaseUrl(authBaseUrl, publicToken);
  }, [authBaseUrl]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const effectiveStatus = statusFilter === "all" ? undefined : statusFilter;
  const needed = (pageIndex + 1) * pageSize + 1;
  const fetchLimit = Math.min(needed, 100);

  const query = useMemo(
    () => ({
      type: "P2P" as const,
      status: effectiveStatus,
      // Fetch enough rows from each list so the merged view can be paginated locally.
      limit: fetchLimit,
      offset: 0,
    }),
    [effectiveStatus, fetchLimit],
  );

  const incoming = useIncomingPaymentRequestHistory(query);
  const outgoing = useOutgoingPaymentRequestHistory(query);
  const { tenantId, clientId, userId } = useIeeContext();
  const iee = useIeeReceiptAction();
  const { cancel: cancelRequest } = useCancelPaymentRequest();
  const { decline: declineRequest } = useDeclinePaymentRequest();
  const { remind: remindRequest } = useRemindPaymentRequest();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const canPrev = pageIndex > 0;
  const mergedRequests = useMemo(() => {
    const list: Array<any & { direction: "incoming" | "outgoing" }> = [];
    const seen = new Set<string>();

    const add = (requests: any[] | undefined, direction: "incoming" | "outgoing") => {
      for (const r of requests ?? []) {
        const key = String(r?.id ?? r?.requestId ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        list.push({ ...(r as any), direction });
      }
    };

    add(incoming.requests as any[], "incoming");
    add(outgoing.requests as any[], "outgoing");

    const toEpoch = (value: unknown) => {
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

  const handleCancel = useCallback(async (requestId: string) => {
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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }
      await cancelRequest(requestId, { receipt: receiptResult.receipt });
      toastSuccess("Payment request cancelled successfully");
      outgoing.refetch();
    } catch (err) {
      toastError("Cancel payment request", err, "Failed to cancel payment request");
    } finally {
      setCancellingId(null);
    }
  }, [cancelRequest, clientId, iee, outgoing, tenantId, userId]);

  const handleDecline = useCallback(async (requestId: string) => {
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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }
      await declineRequest(requestId, { receipt: receiptResult.receipt });
      toastSuccess("Payment request declined successfully");
      incoming.refetch();
    } catch (err) {
      toastError("Decline payment request", err, "Failed to decline payment request");
    } finally {
      setDecliningId(null);
    }
  }, [clientId, declineRequest, iee, incoming, tenantId, userId]);

  const handleRemind = useCallback(async (requestId: string) => {
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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }
      await remindRequest(requestId, { receipt: receiptResult.receipt });
      toastSuccess("Reminder sent");
      outgoing.refetch();
      incoming.refetch();
    } catch (err) {
      toastError("Remind payment request", err, "Failed to send reminder");
    } finally {
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
    window.addEventListener(REQUEST_CREATED_EVENT, handler as any);
    return () => window.removeEventListener(REQUEST_CREATED_EVENT, handler as any);
  }, [incoming, outgoing]);

  const isLoading = incoming.isLoading || outgoing.isLoading;
  const error = incoming.error || outgoing.error;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="h-full flex flex-col">
        <CardHeader className="space-y-4">
          <CardHeaderRow
            title={
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-5" />
                Request History
              </CardTitle>
            }
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                  <RefreshCw className={isLoading ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
                  Refresh
                </Button>
              </div>
            }
          />
          <CardDescription>
            View incoming and outgoing requests across all statuses, and open the hosted pay link when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <div className="flex h-full flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPageIndex(0); }}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="declined">Declined</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="failed">Failed</option>
              </select>

              <Label className="text-xs text-muted-foreground">Rows</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm shrink-0">
              <AlertCircle className="mt-0.5 size-4 text-destructive" />
              <div className="text-destructive">{String(error?.message || "Failed to load requests")}</div>
            </div>
          ) : null}

          <div className="space-y-3 sm:hidden">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                Loading...
              </div>
            ) : pageRequests.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No requests found
              </div>
            ) : (
              pageRequests.map((r: any) => {
                const payUrl = r.publicToken ? buildPayUrl(r.publicToken) : "";
                const isIncoming = r.direction === "incoming";
                const counterpartyRaw = isIncoming ? r.requesterUserId : r.payerEmail;
                const counterparty = String(counterpartyRaw ?? "—");
                return (
                  <div key={r.id || r.requestId} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isIncoming ? (
                          <Inbox className="size-4 text-emerald-600" />
                        ) : (
                          <Send className="size-4 text-blue-600" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {isIncoming ? "Incoming" : "Outgoing"}
                        </span>
                      </div>
                      {getStatusBadge(r.status)}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="text-xs text-muted-foreground">Counterparty</div>
                      <div className="font-mono break-words">{counterparty}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{formatAmount(r)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={!payUrl}
                        onClick={() => copyText(payUrl)}
                        aria-label="Copy pay link"
                      >
                        <Copy />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={!payUrl}
                        onClick={() => window.open(payUrl, "_blank", "noopener,noreferrer")}
                        aria-label="Open pay link"
                      >
                        <LinkIcon />
                      </Button>
                      {isIncoming && r.status === "pending" && (
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          disabled={decliningId === r.requestId}
                          onClick={() => handleDecline(r.requestId)}
                          aria-label="Decline request"
                        >
                          {decliningId === r.requestId ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <XCircle className="size-4" />
                          )}
                        </Button>
                      )}
                      {!isIncoming && r.status === "pending" && (
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          disabled={cancellingId === r.requestId}
                          onClick={() => handleCancel(r.requestId)}
                          aria-label="Cancel request"
                        >
                          {cancellingId === r.requestId ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <X className="size-4" />
                          )}
                        </Button>
                      )}
                      {r.status === "pending" && (
                        <Button
                          size="icon-sm"
                          variant="outline"
                          disabled={remindingId === r.requestId}
                          onClick={() => handleRemind(r.requestId)}
                          aria-label="Remind payer"
                        >
                          {remindingId === r.requestId ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Bell className="size-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden sm:block rounded-lg border flex-1 min-h-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" aria-label="Direction">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block h-full w-full" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>Direction</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : pageRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRequests.map((r: any) => {
                    const payUrl = r.publicToken ? buildPayUrl(r.publicToken) : "";
                    const isIncoming = r.direction === "incoming";
                    const counterpartyRaw = isIncoming ? r.requesterUserId : r.payerEmail;
                    const counterparty = String(counterpartyRaw ?? "—");
                    return (
                      <TableRow key={r.id || r.requestId}>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center justify-center"
                                aria-label={isIncoming ? "Incoming" : "Outgoing"}
                              >
                                {isIncoming ? (
                                  <Inbox className="size-4 text-emerald-600" />
                                ) : (
                                  <Send className="size-4 text-blue-600" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{isIncoming ? "Incoming" : "Outgoing"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate" aria-label={counterparty}>
                                {counterparty}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{counterparty}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{formatAmount(r)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    disabled={!payUrl}
                                    onClick={() => copyText(payUrl)}
                                    aria-label="Copy pay link"
                                  >
                                    <Copy />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Copy pay link</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    disabled={!payUrl}
                                    onClick={() => window.open(payUrl, "_blank", "noopener,noreferrer")}
                                    aria-label="Open pay link"
                                  >
                                    <LinkIcon />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Open pay link</TooltipContent>
                            </Tooltip>
                            {isIncoming && r.status === "pending" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      size="icon-sm"
                                      variant="destructive"
                                      disabled={decliningId === r.requestId}
                                      onClick={() => handleDecline(r.requestId)}
                                      aria-label="Decline request"
                                    >
                                      {decliningId === r.requestId ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <XCircle className="size-4" />
                                      )}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Decline request</TooltipContent>
                              </Tooltip>
                            )}
                            {!isIncoming && r.status === "pending" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      size="icon-sm"
                                      variant="destructive"
                                      disabled={cancellingId === r.requestId}
                                      onClick={() => handleCancel(r.requestId)}
                                      aria-label="Cancel request"
                                    >
                                      {cancellingId === r.requestId ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <X className="size-4" />
                                      )}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Cancel request</TooltipContent>
                              </Tooltip>
                            )}
                            {r.status === "pending" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      size="icon-sm"
                                      variant="outline"
                                      disabled={remindingId === r.requestId}
                                      onClick={() => handleRemind(r.requestId)}
                                      aria-label="Remind payer"
                                    >
                                      {remindingId === r.requestId ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <Bell className="size-4" />
                                      )}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Send reminder</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between shrink-0">
            <div className="text-xs text-muted-foreground">
              Page {pageIndex + 1}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setPageIndex((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

 
