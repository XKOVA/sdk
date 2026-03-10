/**
 * Props for {@link HumanIdentity}.
 *
 * @remarks
 * Purpose:
 * - Configure toast handling for the profile card.
 *
 * When to use:
 * - Use when providing a custom toast renderer.
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
 * - Used by a component that calls sdk-react profile hooks.
 */
export interface HumanIdentityProps {
    /**
     * Optional toast/notification hook.
     * The playground passes `sonner` here; SDK UI stays dependency-free.
     */
    onToast?: (type: "success" | "error" | "info", message: string) => void;
}
/**
 * User profile card with hosted email change launch.
 *
 * @remarks
 * Purpose:
 * - Display basic user profile data and enable name/email updates.
 *
 * When to use:
 * - Use when providing an account/profile settings screen.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: HumanIdentityProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element or null when user is missing.
 *
 * Errors/failure modes:
 * - Surfaces errors via toast messages.
 *
 * Side effects:
 * - Issues oauth-server requests for profile updates (IEE (SafeApprove)-gated).
 * - Launches the hosted email-change UI on the tenant auth domain.
 *
 * Invariants/assumptions:
 * - Requires an authenticated user to render.
 *
 * Data/auth references:
 * - Uses `/oauth/user` via sdk-react hooks and `/email-change` hosted UI.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 */
export declare function HumanIdentity({ onToast }: HumanIdentityProps): import("react/jsx-runtime.js").JSX.Element | null;
