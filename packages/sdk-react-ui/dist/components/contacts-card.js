"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAuth, useContacts, useCreateContact, useDeleteContact, useUpdateContact, useIeeReceiptAction, useIeeContext, } from "@xkova/sdk-react";
import { ArrowDownLeft, ArrowUpRight, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notify as notifyToast } from "../toast-utils.js";
import { cn } from "../utils.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow } from "./ui/card-layout.js";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Select } from "./ui/select.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { SendPaymentCard } from "./send-payment-card.js";
import { RequestPaymentCard } from "./requests-card.js";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "./ui/alert-dialog.js";
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
export function ContactsCard({ onToast, pageSize = 10, autoRefreshMs, className, }) {
    const { status } = useAuth();
    const { tenantId, clientId, userId } = useIeeContext();
    const iee = useIeeReceiptAction();
    const notify = useCallback((type, message, err) => {
        notifyToast(type, message, {
            onToast,
            error: err,
            context: "ContactsCard",
            fallbackForError: message,
        });
    }, [onToast]);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState(undefined);
    const [rowsPerPage, setRowsPerPage] = useState(() => {
        const n = Number(pageSize);
        if (!Number.isFinite(n) || n <= 0)
            return 10;
        return Math.min(Math.floor(n), 100);
    });
    const [pageIndex, setPageIndex] = useState(0);
    // Debounce search input to avoid excessive requests while typing.
    useEffect(() => {
        const t = setTimeout(() => {
            const q = searchInput.trim();
            setSearchQuery(q.length > 0 ? q : undefined);
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);
    // Reset paging when search query or page size changes.
    useEffect(() => {
        setPageIndex(0);
    }, [searchQuery, rowsPerPage]);
    const offset = pageIndex * rowsPerPage;
    const { contacts, total, isLoading, error, refetch, canRead, canManage } = useContacts({
        query: searchQuery,
        limit: rowsPerPage,
        offset,
        autoRefreshMs,
    });
    const { create, isLoading: creating } = useCreateContact();
    const { update, isLoading: updating } = useUpdateContact();
    const { remove, isLoading: deleting } = useDeleteContact();
    const [dialog, setDialog] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [shortcutDialog, setShortcutDialog] = useState(null);
    const [formEmail, setFormEmail] = useState("");
    const [formName, setFormName] = useState("");
    const [formError, setFormError] = useState(null);
    useEffect(() => {
        if (!dialog)
            return;
        setFormError(null);
        if (dialog.kind === "create") {
            setFormEmail("");
            setFormName("");
            return;
        }
        setFormEmail(String(dialog.contact.email ?? ""));
        setFormName(String(dialog.contact.name ?? ""));
    }, [dialog]);
    const canPrev = pageIndex > 0;
    const canNext = offset + rowsPerPage < total;
    const pageRangeLabel = useMemo(() => {
        if (total <= 0)
            return "0";
        const start = offset + 1;
        const end = Math.min(offset + (contacts?.length ?? 0), total);
        return `${start}–${end}`;
    }, [contacts?.length, offset, total]);
    const handleOpenCreate = useCallback(() => {
        if (!canManage) {
            notify("error", "Missing scope: contacts:manage");
            return;
        }
        setDialog({ kind: "create" });
    }, [canManage, notify]);
    const handleOpenEdit = useCallback((contact) => {
        if (!canManage) {
            notify("error", "Missing scope: contacts:manage");
            return;
        }
        setDialog({ kind: "edit", contact });
    }, [canManage, notify]);
    const handleSave = useCallback(async () => {
        if (!dialog)
            return;
        const email = formEmail.trim();
        const name = formName.trim();
        if (!email) {
            const msg = "Email is required";
            setFormError(msg);
            notify("error", msg);
            return;
        }
        if (!email.includes("@")) {
            const msg = "Enter a valid email address";
            setFormError(msg);
            notify("error", msg);
            return;
        }
        if (!name) {
            const msg = "Name is required";
            setFormError(msg);
            notify("error", msg);
            return;
        }
        setFormError(null);
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            if (dialog.kind === "create") {
                const receiptResult = await iee.run({
                    actionType: "contact_create_v1",
                    payload: {
                        tenant_id: tenantId,
                        client_id: clientId,
                        user_id: userId,
                        email,
                        name,
                    },
                });
                if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                    throw new Error(receiptResult.status === "cancelled"
                        ? "SafeApprove approval cancelled"
                        : receiptResult.error?.message ?? "SafeApprove approval failed");
                }
                await create({
                    email,
                    name,
                }, { receipt: receiptResult.receipt });
                notify("success", "Contact added");
                setDialog(null);
                await refetch();
                return;
            }
            const originalEmail = String(dialog.contact.email ?? "");
            const originalName = String(dialog.contact.name ?? "");
            const payload = {};
            if (email !== originalEmail)
                payload.email = email;
            // apps/api requires non-empty names; clearing is not supported.
            if (name !== originalName)
                payload.name = name;
            if (!payload.email && !payload.name) {
                setDialog(null);
                return;
            }
            const receiptResult = await iee.run({
                actionType: "contact_update_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    contact_id: dialog.contact.id,
                    email: payload.email,
                    name: payload.name,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            await update(dialog.contact.id, payload, { receipt: receiptResult.receipt });
            notify("success", "Contact updated");
            setDialog(null);
            await refetch();
        }
        catch (err) {
            const fallback = "Failed to save contact";
            setFormError(err instanceof Error ? err.message : fallback);
            notify("error", fallback, err);
        }
    }, [clientId, create, dialog, formEmail, formName, iee, notify, refetch, tenantId, update, userId]);
    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget)
            return;
        try {
            if (!tenantId || !clientId || !userId) {
                throw new Error("Missing tenant/client/user context");
            }
            const receiptResult = await iee.run({
                actionType: "contact_delete_v1",
                payload: {
                    tenant_id: tenantId,
                    client_id: clientId,
                    user_id: userId,
                    contact_id: deleteTarget.id,
                },
            });
            if (receiptResult.status !== "approved" || !receiptResult.receipt) {
                throw new Error(receiptResult.status === "cancelled"
                    ? "SafeApprove approval cancelled"
                    : receiptResult.error?.message ?? "SafeApprove approval failed");
            }
            await remove(deleteTarget.id, { receipt: receiptResult.receipt });
            notify("success", "Contact deleted");
            setDeleteTarget(null);
            // If we deleted the last row on this page, go back one page (best-effort).
            if ((contacts?.length ?? 0) <= 1 && pageIndex > 0) {
                setPageIndex((p) => Math.max(0, p - 1));
            }
            await refetch();
        }
        catch (err) {
            notify("error", "Failed to delete contact", err);
        }
    }, [clientId, contacts?.length, deleteTarget, iee, notify, pageIndex, refetch, remove, tenantId, userId]);
    const handleRefresh = useCallback(async () => {
        try {
            await refetch();
        }
        catch (err) {
            notify("error", "Failed to refresh contacts", err);
        }
    }, [notify, refetch]);
    const handleOpenPay = useCallback((contact) => {
        setShortcutDialog({ kind: "pay", contact });
    }, []);
    const handleOpenReceive = useCallback((contact) => {
        setShortcutDialog({ kind: "receive", contact });
    }, []);
    if (status !== "authenticated")
        return null;
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { className: cn("w-full", className), children: [_jsx(CardHeader, { className: "space-y-4", children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Users, { className: "size-5" }), "Contacts"] }), description: _jsx(CardDescription, { children: "Manage your personal contacts. Add, edit, or remove entries." }), actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { type: "button", variant: "outline", size: "icon-sm", onClick: handleRefresh, disabled: isLoading, "aria-label": "Refresh contacts", children: _jsx(RefreshCw, { className: isLoading ? "size-4 animate-spin" : "size-4" }) }) }) }), _jsx(TooltipContent, { children: "Refresh" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsxs(Button, { type: "button", onClick: handleOpenCreate, disabled: !canManage, children: [_jsx(Plus, { className: "mr-2 size-4" }), "Add"] }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: contacts:manage" : "Add contact" })] })] }) }) }), _jsxs(CardContent, { className: "space-y-4", children: [!canRead && (_jsxs("div", { className: "rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground", children: ["Contacts are unavailable because your token is missing", " ", _jsx("span", { className: "font-mono", children: "contacts:read" }), ". Update your OAuth scopes to enable this card."] })), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Label, { htmlFor: "contacts-search", children: "Search" }), _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { id: "contacts-search", value: searchInput, onChange: (e) => setSearchInput(e.target.value), placeholder: "Search by name or email", className: "pl-9", disabled: !canRead })] })] }), _jsx("div", { className: "flex items-end gap-2", children: _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contacts-rows", children: "Rows" }), _jsx(Select, { id: "contacts-rows", value: String(rowsPerPage), onChange: (e) => setRowsPerPage(Number(e.target.value)), disabled: !canRead, className: "w-[130px]", children: [5, 10, 20, 50, 100].map((n) => (_jsxs("option", { value: String(n), children: [n, " / page"] }, n))) })] }) })] }), error && (_jsx("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive", children: error.message || "Failed to load contacts" })), _jsx("div", { className: "space-y-3 sm:hidden", children: isLoading ? (_jsxs("div", { className: "py-8 text-center text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "mx-auto mb-2 size-4 animate-spin" }), "Loading..."] })) : (contacts?.length ?? 0) === 0 ? (_jsx("div", { className: "py-8 text-center text-sm text-muted-foreground", children: searchQuery ? "No contacts match your search" : "No contacts yet" })) : (contacts.map((c) => {
                                const label = String(c.name ?? "").trim() || c.email;
                                return (_jsxs("div", { className: "rounded-lg border border-border/60 p-3 space-y-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: label }), _jsx("div", { className: "font-mono text-xs text-muted-foreground break-all", children: c.email })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { type: "button", size: "icon-sm", variant: "default", onClick: () => handleOpenPay({ email: c.email, name: label }), "aria-label": `Pay ${label}`, children: _jsx(ArrowUpRight, { className: "size-4" }) }) }), _jsx(TooltipContent, { children: "Pay" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { type: "button", size: "icon-sm", variant: "outline", onClick: () => handleOpenReceive({ email: c.email, name: label }), "aria-label": `Receive from ${label}`, children: _jsx(ArrowDownLeft, { className: "size-4" }) }) }), _jsx(TooltipContent, { children: "Receive" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { type: "button", size: "icon-sm", variant: "outline", onClick: () => handleOpenEdit({ id: c.id, email: c.email, name: c.name ?? null }), disabled: !canManage, "aria-label": `Edit ${label}`, children: _jsx(Pencil, { className: "size-4" }) }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: contacts:manage" : "Edit" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { type: "button", size: "icon-sm", variant: "outline", className: "text-red-400 hover:text-red-300", onClick: () => setDeleteTarget({ id: c.id, label }), disabled: !canManage || deleting, "aria-label": `Delete ${label}`, children: _jsx(Trash2, { className: "size-4" }) }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: contacts:manage" : "Delete" })] })] })] }, c.id));
                            })) }), _jsx("div", { className: "hidden sm:block rounded-lg border overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Name" }), _jsx(TableHead, { children: "Email" }), _jsx(TableHead, { className: "text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: isLoading ? (_jsx(TableRow, { children: _jsxs(TableCell, { colSpan: 3, className: "py-8 text-center text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "mx-auto mb-2 size-4 animate-spin" }), "Loading..."] }) })) : (contacts?.length ?? 0) === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 3, className: "py-8 text-center", children: _jsx("div", { className: "text-sm text-muted-foreground", children: searchQuery ? "No contacts match your search" : "No contacts yet" }) }) })) : (contacts.map((c) => {
                                            const label = String(c.name ?? "").trim() || c.email;
                                            return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: label }), _jsx(TableCell, { className: "font-mono text-xs", children: c.email }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { type: "button", size: "icon-sm", variant: "default", onClick: () => handleOpenPay({ email: c.email, name: label }), "aria-label": `Pay ${label}`, children: _jsx(ArrowUpRight, { className: "size-4" }) }) }), _jsx(TooltipContent, { children: "Pay" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { type: "button", size: "icon-sm", variant: "outline", onClick: () => handleOpenReceive({ email: c.email, name: label }), "aria-label": `Receive from ${label}`, children: _jsx(ArrowDownLeft, { className: "size-4" }) }) }), _jsx(TooltipContent, { children: "Receive" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { type: "button", size: "icon-sm", variant: "outline", onClick: () => handleOpenEdit({ id: c.id, email: c.email, name: c.name ?? null }), disabled: !canManage, "aria-label": `Edit ${label}`, children: _jsx(Pencil, { className: "size-4" }) }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: contacts:manage" : "Edit" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { type: "button", size: "icon-sm", variant: "outline", className: "text-red-400 hover:text-red-300", onClick: () => setDeleteTarget({ id: c.id, label }), disabled: !canManage || deleting, "aria-label": `Delete ${label}`, children: _jsx(Trash2, { className: "size-4" }) }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: contacts:manage" : "Delete" })] })] }) })] }, c.id));
                                        })) })] }) }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "text-sm text-muted-foreground", children: total > 0 ? (_jsxs(_Fragment, { children: ["Showing ", pageRangeLabel, " of ", total] })) : (_jsx(_Fragment, { children: "Showing 0" })) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setPageIndex((p) => Math.max(0, p - 1)), disabled: !canPrev || isLoading || !canRead, "aria-label": "Previous contacts page", children: "Prev" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setPageIndex((p) => p + 1), disabled: !canNext || isLoading || !canRead, "aria-label": "Next contacts page", children: "Next" })] })] })] }), _jsx(Dialog, { open: dialog !== null, onOpenChange: (open) => (!open ? setDialog(null) : null), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogTitle, { children: dialog?.kind === "edit" ? "Edit contact" : "Add contact" }), _jsxs("div", { className: "space-y-4 mt-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-email", children: "Email" }), _jsx(Input, { id: "contact-email", type: "email", value: formEmail, onChange: (e) => setFormEmail(e.target.value), placeholder: "name@example.com", disabled: !canManage || creating || updating, autoComplete: "email" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-name", children: "Name" }), _jsx(Input, { id: "contact-name", value: formName, onChange: (e) => setFormName(e.target.value), placeholder: "Jane Doe", disabled: !canManage || creating || updating, autoComplete: "name" })] }), formError ? (_jsx("div", { className: "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive", children: formError })) : null, _jsxs("div", { className: "flex items-center justify-end gap-2 pt-2 border-t", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setDialog(null), disabled: creating || updating, children: "Cancel" }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsxs(Button, { type: "button", onClick: handleSave, disabled: !canManage || creating || updating, children: [(creating || updating) ? (_jsx(Loader2, { className: "mr-2 size-4 animate-spin" })) : null, "Save"] }) }) }), _jsx(TooltipContent, { children: !canManage ? "Missing scope: contacts:manage" : "Save contact" })] })] })] })] }) }), _jsx(Dialog, { open: shortcutDialog !== null, onOpenChange: (open) => (!open ? setShortcutDialog(null) : null), children: _jsxs(DialogContent, { className: "sm:max-w-2xl p-0 overflow-hidden overflow-y-auto", children: [_jsx(DialogTitle, { className: "sr-only", children: shortcutDialog?.kind === "pay" ? "Pay contact" : "Receive from contact" }), shortcutDialog?.kind === "pay" ? (_jsx(SendPaymentCard, { defaultRecipient: shortcutDialog.contact.email, onSuccess: () => {
                                    notify("success", "Submitted");
                                    setShortcutDialog(null);
                                } })) : shortcutDialog?.kind === "receive" ? (_jsx(RequestPaymentCard, { defaultPayerEmail: shortcutDialog.contact.email })) : null] }) }), _jsx(AlertDialog, { open: !!deleteTarget, onOpenChange: () => setDeleteTarget(null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Delete contact?" }), _jsxs(AlertDialogDescription, { children: ["This will remove ", _jsx("strong", { children: deleteTarget?.label ?? "this contact" }), " from your contacts list. This action cannot be undone."] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: deleting, children: "Cancel" }), _jsxs(AlertDialogAction, { onClick: handleConfirmDelete, className: "bg-red-600 hover:bg-red-700", disabled: deleting, children: [deleting ? _jsx(Loader2, { className: "mr-2 size-4 animate-spin" }) : null, "Delete"] })] })] }) })] }) }));
}
