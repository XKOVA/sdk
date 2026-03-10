"use client";

import {
  useAuth,
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
  useIeeReceiptAction,
  useIeeContext,
} from "@xkova/sdk-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog.js";

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

type ContactsDialogState =
  | { kind: "create" }
  | { kind: "edit"; contact: { id: string; email: string; name?: string | null } };

type ContactsShortcutDialogState =
  | { kind: "pay"; contact: { email: string; name: string } }
  | { kind: "receive"; contact: { email: string; name: string } };

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
export function ContactsCard({
  onToast,
  pageSize = 10,
  autoRefreshMs,
  className,
}: ContactsCardProps) {
  const { status } = useAuth();
  const { tenantId, clientId, userId } = useIeeContext();
  const iee = useIeeReceiptAction();

  const notify = useCallback(
    (type: "success" | "error" | "info", message: string, err?: unknown) => {
      notifyToast(type, message, {
        onToast,
        error: err,
        context: "ContactsCard",
        fallbackForError: message,
      });
    },
    [onToast],
  );

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    const n = Number(pageSize);
    if (!Number.isFinite(n) || n <= 0) return 10;
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

  const [dialog, setDialog] = useState<ContactsDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; label: string }>(null);
  const [shortcutDialog, setShortcutDialog] = useState<ContactsShortcutDialogState | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!dialog) return;
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
    if (total <= 0) return "0";
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

  const handleOpenEdit = useCallback(
    (contact: { id: string; email: string; name?: string | null }) => {
      if (!canManage) {
        notify("error", "Missing scope: contacts:manage");
        return;
      }
      setDialog({ kind: "edit", contact });
    },
    [canManage, notify],
  );

  const handleSave = useCallback(async () => {
    if (!dialog) return;

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
          throw new Error(
            receiptResult.status === "cancelled"
              ? "SafeApprove approval cancelled"
              : receiptResult.error?.message ?? "SafeApprove approval failed",
          );
        }
        await create(
          {
            email,
            name,
          },
          { receipt: receiptResult.receipt },
        );
        notify("success", "Contact added");
        setDialog(null);
        await refetch();
        return;
      }

      const originalEmail = String(dialog.contact.email ?? "");
      const originalName = String(dialog.contact.name ?? "");

      const payload: { email?: string; name?: string } = {};
      if (email !== originalEmail) payload.email = email;
      // apps/api requires non-empty names; clearing is not supported.
      if (name !== originalName) payload.name = name;

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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }
      await update(dialog.contact.id, payload, { receipt: receiptResult.receipt });
      notify("success", "Contact updated");
      setDialog(null);
      await refetch();
    } catch (err) {
      const fallback = "Failed to save contact";
      setFormError(err instanceof Error ? err.message : fallback);
      notify("error", fallback, err);
    }
  }, [clientId, create, dialog, formEmail, formName, iee, notify, refetch, tenantId, update, userId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

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
        throw new Error(
          receiptResult.status === "cancelled"
            ? "SafeApprove approval cancelled"
            : receiptResult.error?.message ?? "SafeApprove approval failed",
        );
      }
      await remove(deleteTarget.id, { receipt: receiptResult.receipt });
      notify("success", "Contact deleted");
      setDeleteTarget(null);

      // If we deleted the last row on this page, go back one page (best-effort).
      if ((contacts?.length ?? 0) <= 1 && pageIndex > 0) {
        setPageIndex((p) => Math.max(0, p - 1));
      }

      await refetch();
    } catch (err) {
      notify("error", "Failed to delete contact", err);
    }
  }, [clientId, contacts?.length, deleteTarget, iee, notify, pageIndex, refetch, remove, tenantId, userId]);

  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (err) {
      notify("error", "Failed to refresh contacts", err);
    }
  }, [notify, refetch]);

  const handleOpenPay = useCallback(
    (contact: { email: string; name: string }) => {
      setShortcutDialog({ kind: "pay", contact });
    },
    [],
  );

  const handleOpenReceive = useCallback(
    (contact: { email: string; name: string }) => {
      setShortcutDialog({ kind: "receive", contact });
    },
    [],
  );

  if (status !== "authenticated") return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className={cn("w-full", className)}>
        <CardHeader className="space-y-4">
        <CardHeaderRow
          title={
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Contacts
            </CardTitle>
          }
          description={
            <CardDescription>
              Manage your personal contacts. Add, edit, or remove entries.
            </CardDescription>
          }
          actions={
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={handleRefresh}
                      disabled={isLoading}
                      aria-label="Refresh contacts"
                    >
                      <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      onClick={handleOpenCreate}
                      disabled={!canManage}
                    >
                      <Plus className="mr-2 size-4" />
                      Add
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!canManage ? "Missing scope: contacts:manage" : "Add contact"}
                </TooltipContent>
              </Tooltip>
            </div>
          }
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {!canRead && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            Contacts are unavailable because your token is missing{" "}
            <span className="font-mono">contacts:read</span>. Update your OAuth scopes to enable this card.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-2">
            <Label htmlFor="contacts-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="contacts-search"
                value={searchInput}
                onChange={(e) => setSearchInput((e.target as HTMLInputElement).value)}
                placeholder="Search by name or email"
                className="pl-9"
                disabled={!canRead}
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="contacts-rows">Rows</Label>
              <Select
                id="contacts-rows"
                value={String(rowsPerPage)}
                onChange={(e) => setRowsPerPage(Number((e.target as HTMLSelectElement).value))}
                disabled={!canRead}
                className="w-[130px]"
              >
                {[5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} / page
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error.message || "Failed to load contacts"}
          </div>
        )}

        <div className="space-y-3 sm:hidden">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
              Loading...
            </div>
          ) : (contacts?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? "No contacts match your search" : "No contacts yet"}
            </div>
          ) : (
            contacts.map((c) => {
              const label = String(c.name ?? "").trim() || c.email;

              return (
                <div key={c.id} className="rounded-lg border border-border/60 p-3 space-y-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{label}</div>
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      {c.email}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="default"
                          onClick={() => handleOpenPay({ email: c.email, name: label })}
                          aria-label={`Pay ${label}`}
                        >
                          <ArrowUpRight className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Pay</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={() => handleOpenReceive({ email: c.email, name: label })}
                          aria-label={`Receive from ${label}`}
                        >
                          <ArrowDownLeft className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Receive</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              handleOpenEdit({ id: c.id, email: c.email, name: c.name ?? null })
                            }
                            disabled={!canManage}
                            aria-label={`Edit ${label}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!canManage ? "Missing scope: contacts:manage" : "Edit"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => setDeleteTarget({ id: c.id, label })}
                            disabled={!canManage || deleting}
                            aria-label={`Delete ${label}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!canManage ? "Missing scope: contacts:manage" : "Delete"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden sm:block rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (contacts?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center">
                    <div className="text-sm text-muted-foreground">
                      {searchQuery ? "No contacts match your search" : "No contacts yet"}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((c) => {
                  const label = String(c.name ?? "").trim() || c.email;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="font-mono text-xs">{c.email}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="default"
                                onClick={() => handleOpenPay({ email: c.email, name: label })}
                                aria-label={`Pay ${label}`}
                              >
                                <ArrowUpRight className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Pay</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                onClick={() => handleOpenReceive({ email: c.email, name: label })}
                                aria-label={`Receive from ${label}`}
                              >
                                <ArrowDownLeft className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Receive</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleOpenEdit({ id: c.id, email: c.email, name: c.name ?? null })
                                  }
                                  disabled={!canManage}
                                  aria-label={`Edit ${label}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {!canManage ? "Missing scope: contacts:manage" : "Edit"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="outline"
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => setDeleteTarget({ id: c.id, label })}
                                  disabled={!canManage || deleting}
                                  aria-label={`Delete ${label}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {!canManage ? "Missing scope: contacts:manage" : "Delete"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {total > 0 ? (
              <>
                Showing {pageRangeLabel} of {total}
              </>
            ) : (
              <>Showing 0</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={!canPrev || isLoading || !canRead}
              aria-label="Previous contacts page"
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((p) => p + 1)}
              disabled={!canNext || isLoading || !canRead}
              aria-label="Next contacts page"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(open) => (!open ? setDialog(null) : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{dialog?.kind === "edit" ? "Edit contact" : "Add contact"}</DialogTitle>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail((e.target as HTMLInputElement).value)}
                placeholder="name@example.com"
                disabled={!canManage || creating || updating}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={formName}
                onChange={(e) => setFormName((e.target as HTMLInputElement).value)}
                placeholder="Jane Doe"
                disabled={!canManage || creating || updating}
                autoComplete="name"
              />
            </div>

            {formError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={creating || updating}
              >
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={!canManage || creating || updating}
                    >
                      {(creating || updating) ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!canManage ? "Missing scope: contacts:manage" : "Save contact"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shortcutDialog !== null}
        onOpenChange={(open) => (!open ? setShortcutDialog(null) : null)}
      >
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden overflow-y-auto">
          <DialogTitle className="sr-only">
            {shortcutDialog?.kind === "pay" ? "Pay contact" : "Receive from contact"}
          </DialogTitle>
          {shortcutDialog?.kind === "pay" ? (
            <SendPaymentCard
              defaultRecipient={shortcutDialog.contact.email}
              onSuccess={() => {
                notify("success", "Submitted");
                setShortcutDialog(null);
              }}
            />
          ) : shortcutDialog?.kind === "receive" ? (
            <RequestPaymentCard defaultPayerEmail={shortcutDialog.contact.email} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteTarget?.label ?? "this contact"}</strong> from your contacts list. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </Card>
    </TooltipProvider>
  );
}
