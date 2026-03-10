"use client";

import { useAccountState } from "@xkova/sdk-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow, CardSectionLabel } from "./ui/card-layout.js";
import { Skeleton } from "./ui/skeleton.js";
import { useRefreshState } from "./use-refresh-state.js";
import { Copy, Check, RefreshCw, User } from "lucide-react";

/**
 * Props for {@link AccountCard}.
 *
 * @remarks
 * Purpose:
 * - Configure refresh behavior for the account summary card.
 *
 * When to use:
 * - Use to enable or disable auto-refresh polling.
 *
 * When not to use:
 * - Do not set `refreshMs` if you want manual refresh only.
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
 * - `refreshMs` must be > 0 to enable polling.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react account hooks.
 */
export interface AccountCardProps {
  /** Auto-refresh account state interval in ms */
  refreshMs?: number;
}

/**
 * Account summary card.
 *
 * @remarks
 * Purpose:
 * - Display the authenticated primary account (no balances).
 *
 * When to use:
 * - Use to show primary account identifiers.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: AccountCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders fallback UI when account state cannot be fetched.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Loads account state and optionally polls when `refreshMs` is set.
 *
 * Invariants/assumptions:
 * - Uses `useAccountState` as the source of truth.
 *
 * Data/auth references:
 * - Uses sdk-react account hooks that call oauth-server `/account`.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <AccountCard refreshMs={15000} />
 */
export function AccountCard({
  refreshMs,
}: AccountCardProps) {
  const { accountState, isLoading, error, refresh } = useAccountState();
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const hasAccount = Boolean(accountState?.account);
  const { isInitialLoading, isRefreshing } = useRefreshState(isLoading, hasAccount);

  const primary = accountState?.account ?? null;

  const truncateIdentifier = (value: string) =>
    `${value.slice(0, 6)}...${value.slice(-4)}`;

  const handleCopy = useCallback(async (value: string) => {
    const id = String(value ?? "").trim();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Ignore clipboard errors
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setActionLoading(true);
    try {
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;
    const id = setInterval(() => {
      void handleRefresh();
    }, refreshMs);
    return () => clearInterval(id);
  }, [handleRefresh, refreshMs]);

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
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
            <User className="h-5 w-5" />
            Account
          </CardTitle>
          }
          description={<CardDescription>Your primary account.</CardDescription>}
          actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={actionLoading || isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${actionLoading || isRefreshing ? "animate-spin" : ""}`} />
        </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error.message || "Failed to load accounts"}
          </div>
        )}

        {primary ? (
          <>
            <div className="space-y-2">
              <CardSectionLabel>Primary Account</CardSectionLabel>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                  {truncateIdentifier(primary.account)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(primary.account)}
                  className="shrink-0"
                  aria-label="Copy primary account"
                >
                  {copied === primary.account ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

          </>
        ) : (
          <CardEmptyState>No account available. Sign in to view your account.</CardEmptyState>
        )}
      </CardContent>
    </Card>
  );
}
