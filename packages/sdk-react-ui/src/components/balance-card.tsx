"use client";

import { useTokenBalances } from "@xkova/sdk-react";
import { Button } from "./ui/button.js";
import { BalanceText } from "./ui/balance-text.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import { Skeleton } from "./ui/skeleton.js";
import { useRefreshState } from "./use-refresh-state.js";
import { RefreshCw, Wallet } from "lucide-react";

/**
 * Props for {@link BalanceCard}.
 *
 * @remarks
 * Purpose:
 * - Configure which balances are displayed and how they are rendered.
 *
 * When to use:
 * - Use when customizing balance display options.
 *
 * When not to use:
 * - Do not enable polling if you only want manual refresh.
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
 * - Used by a component that calls sdk-react balance hooks.
 */
export interface BalanceCardProps {
  /** Include native token balance (default: false) */
  showNative?: boolean;
  /** Auto-refresh interval in ms */
  refreshMs?: number;
  /** Show token symbol next to balance (e.g. USDC). Default: false (token is already labeled on the left). */
  showTokenSymbol?: boolean;
  /** Show token logo in the left token icon (replaces initials). Default: true */
  showTokenLogo?: boolean;
}

/**
 * Balance card (token balances).
 *
 * @remarks
 * Purpose:
 * - Display token balances for the authenticated account.
 *
 * When to use:
 * - Use when rendering a balance overview for the current user.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: BalanceCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Falls back to empty state when balances cannot be fetched.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Polls balances when `refreshMs` is set.
 *
 * Invariants/assumptions:
 * - Uses tenant-scoped networks/tokens.
 *
 * Data/auth references:
 * - Uses sdk-react hooks that call balance endpoints.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <BalanceCard refreshMs={30000} />
 */
export function BalanceCard({
  showNative = false,
  refreshMs,
  showTokenSymbol = false,
  showTokenLogo = true,
}: BalanceCardProps) {
  const { balances, isLoading: balancesLoading, account, accountLoading, configLoading, refresh } =
    useTokenBalances({ showNative, refreshMs });

  const combinedLoading = accountLoading || configLoading || balancesLoading;
  const hasBalanceData = Boolean(account) || balances.length > 0;
  const { isInitialLoading, isRefreshing } = useRefreshState(
    combinedLoading,
    hasBalanceData,
  );

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
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
            <Wallet className="h-5 w-5" />
            Balance
          </CardTitle>
          }
          description={<CardDescription>Your token balances.</CardDescription>}
          actions={
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {!account ? (
          <CardEmptyState>Sign in to view your token balances.</CardEmptyState>
        ) : balances.length === 0 ? (
          <CardEmptyState>No tokens found.</CardEmptyState>
        ) : (
          <div className="divide-y divide-border/50">
            {balances.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {showTokenLogo && (item.token as any)?.logoUrl ? (
                      <img
                        src={(item.token as any).logoUrl}
                        alt={`${item.token.symbol} logo`}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <span className="text-xs font-medium">{item.token.symbol?.slice(0, 2) ?? "??"}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{item.token.symbol}</div>
                    {item.isNative && (
                      <div className="text-xs text-muted-foreground">Native</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    <BalanceText
                      value={item.value}
                      decimals={item.token.decimals}
                      symbol={item.token.symbol}
                      isStable={(item.token as any)?.isStable}
                      logoUrl={(item.token as any)?.logoUrl}
                      showSymbol={showTokenSymbol}
                      showLogo={false}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
