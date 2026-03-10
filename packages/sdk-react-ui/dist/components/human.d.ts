import type { UserInfo } from "@xkova/sdk-core";
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
export declare const Human: React.FC<HumanProps>;
