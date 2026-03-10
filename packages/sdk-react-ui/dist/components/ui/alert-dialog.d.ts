import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
/**
 * Root alert dialog component for destructive confirmations.
 *
 * @remarks
 * Purpose:
 * - Provide an accessible confirmation dialog for critical actions.
 *
 * When to use:
 * - Use when the user must confirm a destructive or irreversible action.
 *
 * When not to use:
 * - Do not use for standard dialogs; use {@link Dialog} instead.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Root props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a Radix AlertDialog root element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Manages focus trap and aria attributes while open.
 *
 * Invariants/assumptions:
 * - Should include trigger, content, and at least one action/cancel control.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM focus management.
 */
declare const AlertDialog: typeof AlertDialogPrimitive.Root;
/**
 * Trigger element that opens the alert dialog.
 *
 * @remarks
 * Purpose:
 * - Bind an interactive element to open an alert dialog instance.
 *
 * When to use:
 * - Use inside {@link AlertDialog} to toggle dialog visibility.
 *
 * When not to use:
 * - Do not use outside a {@link AlertDialog} root.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Trigger props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a Radix AlertDialog trigger element.
 *
 * Errors/failure modes:
 * - None; requires a focusable child for full accessibility.
 *
 * Side effects:
 * - Attaches event handlers to open the dialog.
 *
 * Invariants/assumptions:
 * - Must be used within an {@link AlertDialog} root.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
declare const AlertDialogTrigger: typeof AlertDialogPrimitive.Trigger;
/**
 * Portal wrapper for alert dialog content.
 *
 * @remarks
 * Purpose:
 * - Render alert dialog content in a portal for proper stacking.
 *
 * When to use:
 * - Use when composing custom content or overlays.
 *
 * When not to use:
 * - Do not use directly when {@link AlertDialogContent} is sufficient.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Portal props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a portal wrapper element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Mounts content under document.body via portal.
 *
 * Invariants/assumptions:
 * - Should wrap alert dialog overlay and content.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; requires DOM portals.
 */
declare const AlertDialogPortal: typeof AlertDialogPrimitive.Portal;
type AlertDialogOverlayElement = React.ElementRef<typeof AlertDialogPrimitive.Overlay>;
type AlertDialogOverlayProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>;
/**
 * Alert dialog overlay backdrop component.
 *
 * @remarks
 * Purpose:
 * - Provide a translucent backdrop behind alert dialog content.
 *
 * When to use:
 * - Use within {@link AlertDialogPortal} to dim the background.
 *
 * When not to use:
 * - Do not use outside an {@link AlertDialog} root.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Overlay props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying overlay element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Blocks interaction with the background while open.
 *
 * Invariants/assumptions:
 * - Should be paired with {@link AlertDialogContent}.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM.
 */
declare const AlertDialogOverlay: React.ForwardRefExoticComponent<AlertDialogOverlayProps & React.RefAttributes<AlertDialogOverlayElement>>;
type AlertDialogContentElement = React.ElementRef<typeof AlertDialogPrimitive.Content>;
type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>;
/**
 * Alert dialog content container rendered in a portal with an overlay.
 *
 * @remarks
 * Purpose:
 * - Render the confirmation surface for destructive actions.
 *
 * When to use:
 * - Use as the main content wrapper inside {@link AlertDialog}.
 *
 * When not to use:
 * - Do not use for non-destructive dialogs; use {@link DialogContent} instead.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Content props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying content element.
 *
 * Return semantics:
 * - Returns a React element including overlay.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Creates a portal and overlays the page while open.
 *
 * Invariants/assumptions:
 * - Used with {@link AlertDialogAction} and {@link AlertDialogCancel}.
 * - Constrains content height to the viewport and enables vertical scrolling on smaller screens.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM portals and focus management.
 */
declare const AlertDialogContent: React.ForwardRefExoticComponent<AlertDialogContentProps & React.RefAttributes<AlertDialogContentElement>>;
/**
 * Layout wrapper for alert dialog header content.
 *
 * @remarks
 * Purpose:
 * - Provide consistent spacing and alignment for header elements.
 *
 * When to use:
 * - Use inside {@link AlertDialogContent} above the main body.
 *
 * When not to use:
 * - Do not use for footer actions; use {@link AlertDialogFooter}.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
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
 * - Aligns content to center on small screens and left on larger screens.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; used within dialog content.
 */
declare const AlertDialogHeader: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime.js").JSX.Element;
    displayName: string;
};
/**
 * Layout wrapper for alert dialog footer actions.
 *
 * @remarks
 * Purpose:
 * - Provide consistent alignment for confirmation and cancel buttons.
 *
 * When to use:
 * - Use inside {@link AlertDialogContent} below the main body.
 *
 * When not to use:
 * - Do not use for header content; use {@link AlertDialogHeader}.
 *
 * Parameters:
 * - `props`: React HTML div attributes. Nullable: per React types.
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
 * - Stacks actions on small screens, aligns to end on larger screens.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; used within dialog content.
 */
declare const AlertDialogFooter: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime.js").JSX.Element;
    displayName: string;
};
type AlertDialogTitleElement = React.ElementRef<typeof AlertDialogPrimitive.Title>;
type AlertDialogTitleProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>;
/**
 * Alert dialog title element for accessible headings.
 *
 * @remarks
 * Purpose:
 * - Provide a semantic title for the alert dialog.
 *
 * When to use:
 * - Use inside {@link AlertDialogHeader} to label the dialog.
 *
 * When not to use:
 * - Do not use for body copy; use {@link AlertDialogDescription}.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Title props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying title element.
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
 * - Used by assistive technologies to announce dialog titles.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; used within alert dialog content.
 */
declare const AlertDialogTitle: React.ForwardRefExoticComponent<AlertDialogTitleProps & React.RefAttributes<AlertDialogTitleElement>>;
type AlertDialogDescriptionElement = React.ElementRef<typeof AlertDialogPrimitive.Description>;
type AlertDialogDescriptionProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>;
/**
 * Alert dialog description element for supporting text.
 *
 * @remarks
 * Purpose:
 * - Provide descriptive context for a destructive action.
 *
 * When to use:
 * - Use beneath {@link AlertDialogTitle} to explain the confirmation.
 *
 * When not to use:
 * - Do not use for long-form content; place that in the dialog body.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Description props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying description element.
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
 * - Descriptions are announced alongside the title by assistive technologies.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; used within alert dialog content.
 */
declare const AlertDialogDescription: React.ForwardRefExoticComponent<AlertDialogDescriptionProps & React.RefAttributes<AlertDialogDescriptionElement>>;
type AlertDialogActionElement = React.ElementRef<typeof AlertDialogPrimitive.Action>;
type AlertDialogActionProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>;
/**
 * Primary action button for alert dialog confirmation.
 *
 * @remarks
 * Purpose:
 * - Provide a styled confirm action for destructive dialogs.
 *
 * When to use:
 * - Use as the primary confirm button inside {@link AlertDialogFooter}.
 *
 * When not to use:
 * - Do not use for cancel actions; use {@link AlertDialogCancel}.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Action props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying action element.
 *
 * Return semantics:
 * - Returns a React element styled as a primary button.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Activating the action closes the dialog.
 *
 * Invariants/assumptions:
 * - Uses {@link buttonVariants} default styling.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
declare const AlertDialogAction: React.ForwardRefExoticComponent<AlertDialogActionProps & React.RefAttributes<AlertDialogActionElement>>;
type AlertDialogCancelElement = React.ElementRef<typeof AlertDialogPrimitive.Cancel>;
type AlertDialogCancelProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>;
/**
 * Cancel action button for alert dialogs.
 *
 * @remarks
 * Purpose:
 * - Provide a styled cancel button that dismisses the dialog.
 *
 * When to use:
 * - Use as the secondary action inside {@link AlertDialogFooter}.
 *
 * When not to use:
 * - Do not use as the confirm action; use {@link AlertDialogAction}.
 *
 * Parameters:
 * - `props`: Radix AlertDialog Cancel props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying cancel element.
 *
 * Return semantics:
 * - Returns a React element styled as an outline button.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Activating the cancel button closes the dialog.
 *
 * Invariants/assumptions:
 * - Applies outline styling and spacing for stacked layouts.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
declare const AlertDialogCancel: React.ForwardRefExoticComponent<AlertDialogCancelProps & React.RefAttributes<AlertDialogCancelElement>>;
export { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, };
