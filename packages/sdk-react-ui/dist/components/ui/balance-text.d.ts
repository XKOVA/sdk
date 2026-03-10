import * as React from "react";
/**
 * Props for {@link BalanceText}.
 *
 * @remarks
 * Purpose:
 * - Configure formatting and display of token balances.
 *
 * When to use:
 * - Use when rendering balances with optional symbols/logos.
 *
 * When not to use:
 * - Do not use for precise calculations; this is presentation-only.
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
 * - `value` is a base-unit bigint and `decimals` is a non-negative integer.
 *
 * Data/auth references:
 * - None.
 */
export interface BalanceTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    value: bigint;
    decimals: number;
    symbol?: string;
    isStable?: boolean;
    logoUrl?: string;
    /** Show token symbol (e.g. USDC). Default: true */
    showSymbol?: boolean;
    /** Show token logo (icon-sized to text). Default: false */
    showLogo?: boolean;
}
/**
 * Render a formatted token balance with optional symbol/logo.
 *
 * @remarks
 * Purpose:
 * - Present balances using token decimals and stablecoin formatting.
 *
 * When to use:
 * - Use in tables or cards where token balances are shown.
 *
 * When not to use:
 * - Do not use for input validation or arithmetic.
 *
 * Parameters:
 * - `props`: BalanceTextProps. Nullable: no.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Stable tokens are rendered with 2 decimal places and a dollar prefix.
 *
 * Data/auth references:
 * - None.
 */
export declare function BalanceText({ value, decimals, symbol, isStable, logoUrl, showSymbol, showLogo, className, ...props }: BalanceTextProps): import("react/jsx-runtime.js").JSX.Element;
