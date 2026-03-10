"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../utils.js";

/**
 * Root dialog component that manages open state.
 *
 * @remarks
 * Purpose:
 * - Provide the base dialog container and state management.
 *
 * When to use:
 * - Use for general modal dialogs that require focus management.
 *
 * When not to use:
 * - Do not use for destructive confirmations; use {@link AlertDialog} instead.
 *
 * Parameters:
 * - `props`: Radix Dialog Root props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a Radix Dialog root element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Manages focus trapping and aria attributes while open.
 *
 * Invariants/assumptions:
 * - Should wrap {@link DialogTrigger} and {@link DialogContent}.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM focus and portal behavior.
 */
const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;
/**
 * Trigger element that opens the dialog.
 *
 * @remarks
 * Purpose:
 * - Bind an interactive element to open a dialog instance.
 *
 * When to use:
 * - Use inside {@link Dialog} to toggle dialog visibility.
 *
 * When not to use:
 * - Do not use without a parent {@link Dialog}.
 *
 * Parameters:
 * - `props`: Radix Dialog Trigger props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a Radix Dialog trigger element.
 *
 * Errors/failure modes:
 * - None; requires a focusable child for full accessibility.
 *
 * Side effects:
 * - Attaches event handlers to open the dialog.
 *
 * Invariants/assumptions:
 * - Must be used within a {@link Dialog} root.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
const DialogTrigger: typeof DialogPrimitive.Trigger = DialogPrimitive.Trigger;
/**
 * Portal wrapper for dialog content.
 *
 * @remarks
 * Purpose:
 * - Render dialog content in a portal for proper stacking context.
 *
 * When to use:
 * - Use when composing custom dialog content or overlays.
 *
 * When not to use:
 * - Do not use directly when {@link DialogContent} is sufficient.
 *
 * Parameters:
 * - `props`: Radix Dialog Portal props. Nullable: per Radix types.
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
 * - Should wrap dialog overlay/content elements.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; requires DOM portals.
 */
const DialogPortal: typeof DialogPrimitive.Portal = DialogPrimitive.Portal;
/**
 * Close control for dialog content.
 *
 * @remarks
 * Purpose:
 * - Provide an accessible close action for dialogs.
 *
 * When to use:
 * - Use inside {@link DialogContent} to close the dialog.
 *
 * When not to use:
 * - Do not use outside a {@link Dialog} root.
 *
 * Parameters:
 * - `props`: Radix Dialog Close props. Nullable: per Radix types.
 *
 * Return semantics:
 * - Returns a close button element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Closes the dialog when activated.
 *
 * Invariants/assumptions:
 * - Must be used within a {@link Dialog} root.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM events.
 */
const DialogClose: typeof DialogPrimitive.Close = DialogPrimitive.Close;

type DialogOverlayElement = React.ElementRef<typeof DialogPrimitive.Overlay>;
type DialogOverlayProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>;
/**
 * Dialog overlay backdrop component.
 *
 * @remarks
 * Purpose:
 * - Provide a translucent backdrop behind dialog content.
 *
 * When to use:
 * - Use within {@link DialogPortal} to dim the background.
 *
 * When not to use:
 * - Do not use outside a {@link Dialog} root.
 *
 * Parameters:
 * - `props`: Radix Dialog Overlay props. Nullable: per Radix types.
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
 * - Should be paired with {@link DialogContent}.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM.
 */
const DialogOverlay: React.ForwardRefExoticComponent<
  DialogOverlayProps & React.RefAttributes<DialogOverlayElement>
> = React.forwardRef<DialogOverlayElement, DialogOverlayProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentElement = React.ElementRef<typeof DialogPrimitive.Content>;
type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;
/**
 * Dialog content container rendered in a portal with an overlay.
 *
 * @remarks
 * Purpose:
 * - Render the dialog content surface and a default close button.
 *
 * When to use:
 * - Use as the main content wrapper inside {@link Dialog}.
 *
 * When not to use:
 * - Do not use for non-modal overlays; use {@link Tooltip} or {@link SelectMenu}.
 *
 * Parameters:
 * - `props`: Radix Dialog Content props. Nullable: per Radix types.
 * - `ref`: Forwards to the underlying content element.
 *
 * Return semantics:
 * - Returns a React element including overlay and close control.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - Creates a portal and overlays the page while open.
 *
 * Invariants/assumptions:
 * - Includes a built-in close button in the top-right corner.
 * - Constrains content height to the viewport and enables vertical scrolling on smaller screens.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Client-only; relies on DOM portals and focus management.
 */
const DialogContent: React.ForwardRefExoticComponent<
  DialogContentProps & React.RefAttributes<DialogContentElement>
> = React.forwardRef<DialogContentElement, DialogContentProps>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[calc(100vh-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Layout wrapper for dialog header content.
 *
 * @remarks
 * Purpose:
 * - Provide consistent spacing and alignment for header elements.
 *
 * When to use:
 * - Use inside {@link DialogContent} above the main body.
 *
 * When not to use:
 * - Do not use for footer actions; use {@link DialogFooter}.
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
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

/**
 * Layout wrapper for dialog footer actions.
 *
 * @remarks
 * Purpose:
 * - Provide consistent alignment for dialog action buttons.
 *
 * When to use:
 * - Use inside {@link DialogContent} below the main body.
 *
 * When not to use:
 * - Do not use for header content; use {@link DialogHeader}.
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
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

type DialogTitleElement = React.ElementRef<typeof DialogPrimitive.Title>;
type DialogTitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;
/**
 * Dialog title element for accessible headings.
 *
 * @remarks
 * Purpose:
 * - Provide a semantic title for the dialog.
 *
 * When to use:
 * - Use inside {@link DialogHeader} to label the dialog.
 *
 * When not to use:
 * - Do not use for body copy; use {@link DialogDescription}.
 *
 * Parameters:
 * - `props`: Radix Dialog Title props. Nullable: per Radix types.
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
 * - Client-only; used within dialog content.
 */
const DialogTitle: React.ForwardRefExoticComponent<
  DialogTitleProps & React.RefAttributes<DialogTitleElement>
> = React.forwardRef<DialogTitleElement, DialogTitleProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

type DialogDescriptionElement = React.ElementRef<typeof DialogPrimitive.Description>;
type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;
/**
 * Dialog description element for supporting text.
 *
 * @remarks
 * Purpose:
 * - Provide descriptive text for dialog context and accessibility.
 *
 * When to use:
 * - Use beneath {@link DialogTitle} to explain the dialog.
 *
 * When not to use:
 * - Do not use for long-form content; place that in the dialog body.
 *
 * Parameters:
 * - `props`: Radix Dialog Description props. Nullable: per Radix types.
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
 * - Client-only; used within dialog content.
 */
const DialogDescription: React.ForwardRefExoticComponent<
  DialogDescriptionProps & React.RefAttributes<DialogDescriptionElement>
> = React.forwardRef<DialogDescriptionElement, DialogDescriptionProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
