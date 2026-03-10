import { TokenAsset } from "@xkova/sdk-core";
/**
 * Props for {@link SendPaymentCard}.
 *
 * @remarks
 * Purpose:
 * - Configure token allowlists, defaults, and callbacks for send flows.
 *
 * When to use:
 * - Use when embedding the send payments card.
 *
 * When not to use:
 * - Do not pass sensitive data into callbacks.
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
 * - `defaultTokenContract` must match a selectable token to take effect.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react signing and balance hooks.
 */
export interface SendPaymentCardProps {
    /** Restrict to specific tokens */
    allowedTokens?: TokenAsset[];
    /** Default selected token contract */
    defaultTokenContract?: string;
    /** Include native token as a selectable option. Default: false */
    includeNative?: boolean;
    /** Enable verbose debug logging for the send payment flow. */
    debug?: boolean;
    /**
     * Default recipient value to pre-fill the form.
     *
     * @remarks
     * - May be an account identifier (`0x...`) or an email.
     * - Useful for “Pay” shortcuts from a contacts list.
     * - When provided, the input is initialized to this value and resets to it after a successful send.
     */
    defaultRecipient?: string;
    /** Callback when transaction succeeds */
    onSuccess?: (tx: {
        transactionHash?: string;
    }) => void;
    /** Callback when transaction fails */
    onError?: (error: Error) => void;
}
/**
 * Send payments card.
 *
 * @remarks
 * Purpose:
 * - Provide a send form that signs and submits transfers from the primary account.
 *
 * When to use:
 * - Use when enabling end users to send payments.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: SendPaymentCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - Renders inline validation and error messages on failure.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Executes client signing and on-chain transfers.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK session.
 *
 * Data/auth references:
 * - Receipt-gated: client-side signing is disabled in the public SDK. Use the IEE (SafeApprove) iframe modal to obtain a receipt, then call receipt-gated endpoints with `X-XKOVA-IEE-Receipt`.
 * - The IEE (SafeApprove) approval flow is responsible for signing and returning the transaction hash.
 * - The IEE (SafeApprove) approval flow may also return canonical send-payment fields when resolving email recipients server-side.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <SendPaymentCard includeNative onSuccess={(tx) => void tx} />
 */
export declare function SendPaymentCard({ allowedTokens, defaultTokenContract, includeNative, debug, defaultRecipient, onSuccess, onError }: SendPaymentCardProps): import("react/jsx-runtime.js").JSX.Element;
