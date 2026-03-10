"use client";

import type { UserInfo } from "@xkova/sdk-core";
import { useHumanAuth, useHumanBalance } from "@xkova/sdk-react";
import React from "react";

/**
 * Props for {@link Human}.
 *
 * @remarks
 * Purpose:
 * - Configure the auth button label, appearance, and callbacks.
 *
 * When to use:
 * - Use when customizing the Human sign-in/sign-out button.
 *
 * When not to use:
 * - Do not pass sensitive data to callbacks.
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
 * - `variant` and `size` must be supported values.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react auth and balance hooks.
 */
export interface HumanProps {
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  showBalance?: boolean;
  /** Show token symbol next to the balance (e.g. USDC). Default: true */
  showBalanceTokenSymbol?: boolean;
  /** Show token logo next to the balance. Default: false */
  showBalanceTokenLogo?: boolean;
  onSuccess?: (user: UserInfo) => void;
  onError?: (err: Error) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sign-in / sign-up trigger styled as a button but themeable.
 *
 * @remarks
 * Purpose:
 * - Provide a single auth button that handles sign-in, sign-out, and balance display.
 *
 * When to use:
 * - Use in headers or identity surfaces where a compact auth control is needed.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: HumanProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Surfaces OAuth or logout errors via `onError`.
 *
 * Side effects:
 * - Initiates OAuth redirects and fetches balances when enabled.
 *
 * Invariants/assumptions:
 * - Uses sdk-react hooks for auth and balance state.
 *
 * Data/auth references:
 * - Uses sdk-react auth and balance hooks (oauth-server + apps/api).
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <Human label="Sign In" showBalance />
 */
export const Human: React.FC<HumanProps> = ({
  label = "Sign In",
  variant = "primary",
  size = "md",
  showBalance = true,
  showBalanceTokenSymbol = true,
  showBalanceTokenLogo = false,
  onSuccess,
  onError,
  disabled,
  className,
  style,
}) => {
  const { status, user, displayName, handleClick, handleLogout } = useHumanAuth({
    onError
  });
  const { balance: balanceDisplay } = useHumanBalance({ enabled: showBalance });

  // NOTE: onSuccess is kept for API compatibility (even though it isn't used yet).
  void onSuccess;

  const classes = [`xkova-human`, `variant-${variant}`, `size-${size}`, className].filter(Boolean).join(" ");

  if (status === "authenticated" && user) {
    // EXACT match for `@xkova/sdk-react-ui` `Button` with `variant="outline"` + `size="sm"`.
    // (This is the same styling used by the "Dark" button in the playground header.)
    const sdkReactUiButtonOutlineSm =
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs";
    const containerClassName = [classes, sdkReactUiButtonOutlineSm].filter(Boolean).join(" ");
    const logoutButtonClassName =
      "inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-accent hover:text-accent-foreground transition-colors";
    return (
      <div className={containerClassName} style={style}>
        <span className="truncate">{displayName}</span>
        {showBalance && (
          <span className="inline-flex items-center tabular-nums text-muted-foreground">
            {balanceDisplay ? (
              <>
                <span>
                  {balanceDisplay.isStable ? "$" : ""}
                  {balanceDisplay.amountText}
                </span>
                {showBalanceTokenSymbol && balanceDisplay.symbol ? (
                  <span className="ml-1">{balanceDisplay.symbol}</span>
                ) : null}
                {showBalanceTokenLogo && balanceDisplay.logoUrl ? (
                  <img
                    src={balanceDisplay.logoUrl}
                    alt={balanceDisplay.symbol ? `${balanceDisplay.symbol} logo` : "Token logo"}
                    className="ml-1 inline-block h-[1em] w-[1em] rounded-sm object-contain"
                  />
                ) : null}
              </>
            ) : (
              "…"
            )}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={disabled}
          aria-label="Logout"
          className={logoutButtonClassName}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ opacity: 0.9 }}
          >
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 17l5-5-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 12H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const sizeClass =
    size === "lg" ? "h-11 px-8 text-sm" : size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  const variantClass =
    variant === "ghost"
      ? "hover:bg-accent hover:text-accent-foreground"
      : variant === "secondary"
        ? "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80"
        : "bg-primary text-primary-foreground shadow hover:bg-primary/90";
  // Put `classes` last so consuming apps (and sdk-react-ui) can apply a fully-canonical button skin
  // without being overridden by the default base/variant/size styles.
  const unauthClassName = [base, variantClass, sizeClass, classes].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={unauthClassName}
      style={style}
      onClick={handleClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
