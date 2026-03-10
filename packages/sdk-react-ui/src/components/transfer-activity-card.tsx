"use client";

import { useEffect, useMemo, useState } from "react";
import type { TransferTransaction } from "@xkova/sdk-core";
import { useTenantConfig, useTransferTransactions } from "@xkova/sdk-react";
import { ExternalLink, RefreshCw, ArrowDownLeft, ArrowUpRight, History } from "lucide-react";

import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Badge } from "./ui/badge.js";
import { Skeleton } from "./ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue } from "./ui/select-menu.js";
import { BalanceText } from "./ui/balance-text.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { useRefreshState } from "./use-refresh-state.js";

/**
 * Props for {@link TransferActivityCard}.
 *
 * @remarks
 * Purpose:
 * - Configure refresh behavior for the transfer activity card.
 *
 * When to use:
 * - Use to enable or disable auto-refresh polling.
 *
 * When not to use:
 * - Do not set `autoRefreshMs` if you want manual refresh only.
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
 * - `autoRefreshMs` must be > 0 to enable polling.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react transfer hooks.
 */
export interface TransferActivityCardProps {
  /** Auto-refresh interval in ms (disabled when undefined or <= 0). Default: 60000 */
  autoRefreshMs?: number;
}

const toBigIntSafe = (value: unknown): bigint | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
};

const formatDate = (timestamp?: string) => {
  if (!timestamp) return "-";
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
  const s = String(status || "").toLowerCase();
  if (s === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (s === "processing") return <Badge variant="secondary">Processing</Badge>;
  if (s === "completed")
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
        Completed
      </Badge>
    );
  if (s === "failed")
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
        Failed
      </Badge>
    );
  if (s === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  if (s === "expired") return <Badge variant="outline">Expired</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

const getTypeBadge = (type: string) => {
  const t = String(type || "").toLowerCase();
  if (t === "deposit")
    return (
      <Badge variant="secondary" className="gap-1">
        <ArrowDownLeft className="size-3" />
        Deposit
      </Badge>
    );
  if (t === "withdraw")
    return (
      <Badge variant="secondary" className="gap-1">
        <ArrowUpRight className="size-3" />
        Withdraw
      </Badge>
    );
  return <Badge variant="outline">{type}</Badge>;
};

/**
 * Transfer activity card.
 *
 * @remarks
 * Purpose:
 * - List deposit/withdraw activity (provider transactions).
 * - Provide refresh and pagination controls for transfer history.
 * - On small screens, rows render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when showing transfer-provider deposit/withdraw activity.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: TransferActivityCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Displays an error message when fetch fails (including insufficient scope).
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Issues API calls via sdk-react hooks and opens external links.
 *
 * Invariants/assumptions:
 * - Uses authenticated SDK session state for data access.
 *
 * Data/auth references:
 * - Uses `/api/v1/transfers/transactions` via sdk-react transfer hooks.
 *
 * Runtime constraints:
 * - Client component (uses hooks and DOM APIs).
 *
 * @example
 * <TransferActivityCard autoRefreshMs={60000} />
 */
export function TransferActivityCard({ autoRefreshMs = 60000 }: TransferActivityCardProps) {
  const { transferProviders, networks } = useTenantConfig();
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const offset = pageIndex * pageSize;

  // Fetch 1 extra row so we can enable/disable "Next" without needing an exact total.
  const { transactions, isLoading, error, refetch } = useTransferTransactions({
    limit: pageSize + 1,
    offset,
    autoRefreshMs,
  });
  const { isInitialLoading, isRefreshing } = useRefreshState(
    isLoading,
    (transactions?.length ?? 0) > 0,
  );

  // Allow sibling components (like TransfersCard) to trigger a refresh without direct coupling.
  useEffect(() => {
    const handler = () => {
      refetch();
    };
    window.addEventListener("xkova:transfer-activity-updated", handler as any);
    return () => window.removeEventListener("xkova:transfer-activity-updated", handler as any);
  }, [refetch]);

  const hasNext = (transactions?.length ?? 0) > pageSize;
  const canPrev = pageIndex > 0;
  const pageTransactions = (transactions ?? []).slice(0, pageSize);

  const providerById = useMemo(() => {
    const map = new Map<string, { name?: string; logoUrl?: string | null }>();
    for (const p of transferProviders ?? []) {
      const id = String((p as any)?.providerId ?? (p as any)?.id ?? "").trim();
      if (!id) continue;
      map.set(id, { name: (p as any)?.name, logoUrl: (p as any)?.logoUrl ?? null });
    }
    return map;
  }, [transferProviders]);

  const getExplorerTxUrl = (networkId: string | null | undefined, transactionHash: string | null | undefined) => {
    if (!transactionHash) return null;
    const netId = networkId ? String(networkId) : null;
    const net = (networks ?? []).find((n: any) => String(n.networkId) === netId);
    const explorerBase = (net as any)?.explorerUrl ?? (net as any)?.explorer_url ?? null;
    if (!explorerBase) return null;
    return `${String(explorerBase).replace(/\/+$/, "")}/tx/${transactionHash}`;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardHeaderRow
            title={
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" />
                Transfer Activity
              </CardTitle>
            }
            description={
              <CardDescription>
                Recent deposits and withdrawals through your configured providers.
              </CardDescription>
            }
            actions={
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => refetch()}
                        disabled={isRefreshing}
                        aria-label="Refresh transfer activity"
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
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message || "Failed to load transfer activity"}
          </div>
        ) : pageTransactions.length > 0 ? (
          <>
            <div className="space-y-3 sm:hidden">
              {pageTransactions.map((tx: TransferTransaction) => {
                const providerInfo = providerById.get(tx.providerId);
                const providerName =
                  providerInfo?.name ??
                  (tx.providerName && tx.providerName !== "Provider" ? tx.providerName : null) ??
                  tx.providerId;
                const providerLogoUrl = providerInfo?.logoUrl ?? null;

                const txUrl = getExplorerTxUrl(tx.networkId, tx.transactionHash ?? null);
                const providerUrl = tx.providerUrl ? String(tx.providerUrl) : null;
                const cryptoAmount = toBigIntSafe(tx.cryptoAmountWei);

                return (
                  <div key={tx.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      {getTypeBadge(tx.type)}
                      {getStatusBadge(tx.status)}
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      {providerLogoUrl ? (
                        <img
                          src={providerLogoUrl}
                          alt={`${providerName} logo`}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{providerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {tx.paymentMethod ? `Method: ${tx.paymentMethod}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="font-medium tabular-nums">
                        {tx.fiatAmount} {tx.fiatCurrency}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(tx.completedAt ?? tx.updatedAt ?? tx.createdAt)}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {cryptoAmount !== null ? (
                        <BalanceText
                          value={cryptoAmount}
                          decimals={Number(tx.tokenDecimals ?? 18)}
                          symbol={tx.cryptoSymbol}
                          showLogo={false}
                          showSymbol={true}
                        />
                      ) : (
                        "-"
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {txUrl ? (
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          aria-label="View on explorer"
                        >
                          TX
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No tx link</span>
                      )}
                      {providerUrl ? (
                        <a
                          href={providerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          aria-label="Open provider"
                        >
                          Provider
                          <ExternalLink className="size-3" />
                        </a>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTransactions.map((tx: TransferTransaction) => {
                    const providerInfo = providerById.get(tx.providerId);
                    const providerName =
                      providerInfo?.name ??
                      (tx.providerName && tx.providerName !== "Provider" ? tx.providerName : null) ??
                      tx.providerId;
                    const providerLogoUrl = providerInfo?.logoUrl ?? null;

                    const txUrl = getExplorerTxUrl(tx.networkId, tx.transactionHash ?? null);
                    const providerUrl = tx.providerUrl ? String(tx.providerUrl) : null;
                    const cryptoAmount = toBigIntSafe(tx.cryptoAmountWei);

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="sm:whitespace-nowrap">
                          {getTypeBadge(tx.type)}
                        </TableCell>

                        <TableCell className="min-w-0 sm:min-w-[220px]">
                          <div className="flex items-center gap-2 min-w-0">
                            {providerLogoUrl ? (
                              <img
                                src={providerLogoUrl}
                                alt={`${providerName} logo`}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-muted" />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{providerName}</div>
                              <div className="text-xs text-muted-foreground">
                                {tx.paymentMethod ? `Method: ${tx.paymentMethod}` : ""}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="sm:whitespace-nowrap">
                          <div className="font-medium tabular-nums">
                            {tx.fiatAmount} {tx.fiatCurrency}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {cryptoAmount !== null ? (
                              <BalanceText
                                value={cryptoAmount}
                                decimals={Number(tx.tokenDecimals ?? 18)}
                                symbol={tx.cryptoSymbol}
                                showLogo={false}
                                showSymbol={true}
                              />
                            ) : (
                              "-"
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="sm:whitespace-nowrap">
                          {getStatusBadge(tx.status)}
                        </TableCell>

                        <TableCell className="sm:whitespace-nowrap text-muted-foreground">
                          {formatDate(tx.completedAt ?? tx.updatedAt ?? tx.createdAt)}
                        </TableCell>

                        <TableCell className="text-right sm:whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            {txUrl ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={txUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    aria-label="View on explorer"
                                  >
                                    TX
                                    <ExternalLink className="size-3" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>View on explorer</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {providerUrl ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={providerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    aria-label="Open provider"
                                  >
                                    Provider
                                    <ExternalLink className="size-3" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Open provider</TooltipContent>
                              </Tooltip>
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
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-10 space-y-2">
            <History className="size-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No transfer activity found
            </p>
            <p className="text-xs text-muted-foreground">
              Complete a deposit or withdraw to see it here.
            </p>
          </div>
        )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
