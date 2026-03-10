/**
 * Tenant summary card.
 *
 * @remarks
 * Purpose:
 * - Displays tenant identity (name/slug/id), environment (test/live), primary network name,
 *   and the tenant's ERC-20 tokens with icons.
 * - Copy actions and token chips use portaled tooltips for hover hints.
 * - Layout defaults to a single-column grid and expands to two columns at the `sm` breakpoint.
 *
 * When to use:
 * - Use to display tenant identity and configuration in UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Renders a card showing the tenant fields listed above when available.
 * - Renders an empty state when tenant context is missing.
 *
 * Errors/failure modes:
 * - Does not throw. Falls back to "-" for missing tenant fields.
 * - Loading: shows skeleton only on the first load; refresh keeps content and shows a header spinner.
 *
 * Side effects:
 * - Uses the clipboard API when the user clicks copy.
 *
 * Invariants/assumptions:
 * - `useTenantConfig()` is the source of truth for tenant + bootstrap metadata.
 * - Environment is read from `tenant.environment` when present; falls back to primary network `isTestnet`.
 * - Tokens list is filtered to ERC-20 tokens (`contract` is present).
 *
 * Data/auth references:
 * - Uses bootstrap tenant config (`GET /oauth/tenant`) and tenant networks/tokens.
 *
 * @example
 * <TenantCard />
 */
export declare function TenantCard(): import("react/jsx-runtime.js").JSX.Element;
