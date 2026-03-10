/**
 * Props for {@link ContactsCard}.
 *
 * @remarks
 * Purpose:
 * - Configure toast handling, pagination, and refresh behavior for contacts UI.
 *
 * When to use:
 * - Use when customizing contacts list rendering.
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
 * - `pageSize` must be > 0 to enable pagination.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react contacts hooks.
 */
export interface ContactsCardProps {
    /**
     * Optional toast/notification hook.
     *
     * @remarks
     * - The playground passes `sonner` here; SDK UI stays dependency-free.
     */
    onToast?: (type: "success" | "error" | "info", message: string) => void;
    /**
     * Default number of rows per page.
     *
     * @remarks
     * - apps/api uses offset pagination (`limit`/`offset`) for contacts.
     */
    pageSize?: number;
    /**
     * Auto-refresh interval in ms (disabled when undefined or <= 0).
     *
     * @remarks
     * - Contacts change infrequently; a longer interval (e.g. 60s) is usually sufficient.
     */
    autoRefreshMs?: number;
    /** Optional wrapper className. */
    className?: string;
}
/**
 * Personal contacts manager card.
 *
 * @remarks
 * Purpose:
 * - List contacts with pagination and search.
 * - Create and edit contacts via a modal dialog.
 * - Delete contacts with a confirmation dialog.
 * - Action buttons use portaled tooltips for hover hints.
 * - On small screens, contacts render as stacked cards instead of a table.
 *
 * When to use:
 * - Use when providing a full contacts management surface.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Authorization:
 * - Requires `contacts:read` to list contacts.
 * - Requires `contacts:manage` to create/update/delete contacts.
 *
 * Data/auth references:
 * - apps/api: `/api/v1/contacts` contacts endpoints.
 *
 * Parameters:
 * - `props`: ContactsCardProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a card element, or `null` when unauthenticated.
 *
 * Errors/failure modes:
 * - Displays inline error state for fetch failures; toasts for action failures.
 *
 * Side effects:
 * - Performs API calls via `@xkova/sdk-react` hooks.
 *
 * Invariants/assumptions:
 * - Does not render when the user is unauthenticated.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 *
 * @example
 * <ContactsCard pageSize={20} autoRefreshMs={60000} />
 */
export declare function ContactsCard({ onToast, pageSize, autoRefreshMs, className, }: ContactsCardProps): import("react/jsx-runtime.js").JSX.Element | null;
