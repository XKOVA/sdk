import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conditional helpers.
 *
 * @remarks
 * Purpose:
 * - Combine conditional class names and resolve Tailwind conflicts.
 *
 * When to use:
 * - Use when assembling className strings for sdk-react-ui components.
 *
 * When not to use:
 * - Do not use for non-Tailwind styling systems.
 *
 * Parameters:
 * - `inputs`: Class name values (strings, arrays, or conditional objects). Nullable: no.
 *
 * Return semantics:
 * - Returns a merged className string.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Tailwind class conflicts are resolved by tailwind-merge rules.
 *
 * Data/auth references:
 * - None.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Return all focusable elements within a container.
 *
 * @remarks
 * Purpose:
 * - Provide a filtered list of tabbable elements for focus management.
 *
 * When to use:
 * - Use when implementing custom focus traps or modal components.
 *
 * When not to use:
 * - Do not use in non-browser environments (requires DOM).
 *
 * Parameters:
 * - `container`: DOM element to scan. Nullable: no.
 *
 * Return semantics:
 * - Returns an array of focusable elements in document order.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Reads computed styles from the DOM.
 *
 * Invariants/assumptions:
 * - Elements with display:none or visibility:hidden are excluded.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Browser-only (uses `window.getComputedStyle`).
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    // Ignore elements that are visually hidden or inert.
    const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  });
}

/**
 * Trap Tab focus within a container element.
 *
 * @remarks
 * Purpose:
 * - Keep keyboard focus inside modal or drawer boundaries.
 *
 * When to use:
 * - Use in modal/dialog keyboard handlers to enforce focus trapping.
 *
 * When not to use:
 * - Do not use for components that should allow global Tab navigation.
 *
 * Parameters:
 * - `e`: Keyboard event-like object with key and shiftKey. Nullable: no.
 * - `container`: Focus trap container. Nullable: yes (no-op when null).
 *
 * Return semantics:
 * - Returns void; may call preventDefault on the event.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Moves focus to the first/last element in the container.
 *
 * Invariants/assumptions:
 * - Only handles Tab key navigation.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Browser-only (uses DOM APIs).
 */
export function trapFocusWithin(
  e: { key: string; shiftKey: boolean; preventDefault: () => void },
  container: HTMLElement | null,
): void {
  if (e.key !== "Tab") return;
  if (!container) return;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    e.preventDefault();
    (container as HTMLElement).focus?.();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active =
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null;

  if (e.shiftKey) {
    if (!active || active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!active || active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }
}
