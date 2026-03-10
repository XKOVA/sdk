import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatTokenAmount } from "@xkova/sdk-core";
import { cn } from "../../utils.js";
const formatFixed = (value, decimals, fractionDigits) => {
    if (fractionDigits <= 0)
        return value.toString();
    const base = 10n ** BigInt(decimals);
    const scale = 10n ** BigInt(fractionDigits);
    const scaled = value * scale;
    let q = scaled / base;
    const r = scaled % base;
    // round half up
    if (r * 2n >= base)
        q = q + 1n;
    const s = q.toString();
    const whole = s.length > fractionDigits ? s.slice(0, -fractionDigits) : "0";
    const frac = s.length > fractionDigits ? s.slice(-fractionDigits) : s.padStart(fractionDigits, "0");
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${withCommas}.${frac}`;
};
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
export function BalanceText({ value, decimals, symbol, isStable, logoUrl, showSymbol = true, showLogo = false, className, ...props }) {
    const amountText = isStable ? formatFixed(value, decimals, 2) : formatTokenAmount(value, decimals);
    const prefix = isStable ? "$" : "";
    const showSymbolResolved = showSymbol && Boolean(symbol);
    const showLogoResolved = showLogo && Boolean(logoUrl);
    // Logo should match text height (acts like an icon).
    const logoEl = showLogoResolved && logoUrl ? (_jsx("img", { src: logoUrl, alt: symbol ? `${symbol} logo` : "Token logo", className: "inline-block h-[1em] w-[1em] align-[-0.125em] rounded-sm object-contain" })) : null;
    return (_jsxs("span", { className: cn("inline-flex items-baseline tabular-nums", className), ...props, children: [_jsxs("span", { children: [prefix, amountText] }), showSymbolResolved ? _jsx("span", { className: "ml-1", children: symbol }) : null, logoEl ? _jsx("span", { className: showSymbolResolved ? "ml-1" : "ml-1", children: logoEl }) : null] }));
}
