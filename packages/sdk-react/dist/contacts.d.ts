import { type Contact, type ContactsListQuery, type CreateContactInput, type UpdateContactInput, type DeleteContactResult } from "@xkova/sdk-core";
/**
 * Lists personal contacts for the authenticated user.
 *
 * @remarks
 * Purpose:
 * - Fetch and paginate the authenticated user's personal contacts.
 * - Automatically refetches when the SDK invalidates the `contacts` resource.
 *
 * When to use:
 * - Use when building contact lists or search UIs.
 *
 * When not to use:
 * - Do not use when unauthenticated or without contacts scopes.
 *
 * Parameters:
 * - `filter`: Optional search and pagination parameters. Nullable: yes.
 * - `filter.query`: Optional search term (matches name/email). Nullable: yes.
 * - `filter.favoritesOnly`: Legacy filter (ignored by current apps/api schema). Nullable: yes.
 * - `filter.limit`: Page size (1..100). Nullable: yes.
 * - `filter.offset`: Offset (>= 0). Nullable: yes.
 * - `filter.autoRefreshMs`: Refresh interval in ms (polling fallback only when realtime is unavailable). Nullable: yes.
 *
 * Return semantics:
 * - Returns contacts, counts, scope flags, and a `refetch` helper.
 *
 * Errors/failure modes:
 * - Sets `error` when the API request fails or scopes are insufficient.
 *
 * Side effects:
 * - Issues API calls to apps/api when authenticated.
 *
 * Invariants/assumptions:
 * - `contacts` is always an array.
 * - Read requires `contacts:read` (or `contacts:manage` / `all`).
 * - Mutations require `contacts:manage` (or `all`).
 *
 * Data/auth references:
 * - `/api/v1/contacts` (apps/api, bearer token).
 *
 * @example
 * const { contacts, total, canManage } = useContacts({ query: "john", limit: 20, offset: 0 });
 *
 * @see ContactsService
 * @see /api/v1/contacts
 */
export declare const useContacts: (filter?: ContactsListQuery & {
    autoRefreshMs?: number;
}) => {
    contacts: Contact[];
    total: number;
    count: number;
    searchQuery: string | undefined;
    favoritesOnly: boolean | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    canRead: boolean;
    canManage: boolean;
};
/**
 * Creates a new personal contact.
 *
 * @remarks
 * Purpose:
 * - Create a contact record for the authenticated user.
 *
 * - Backed by `POST /api/v1/contacts`.
 * - Requires `contacts:manage` scope.
 *
 * When to use:
 * - Use when creating new contacts in user-managed address books.
 *
 * When not to use:
 * - Do not use when unauthenticated or missing contacts:manage scope.
 *
 * Parameters:
 * - None. Hook-only; call `create(...)` to execute.
 *
 * Return semantics:
 * - Returns `{ create, isLoading, error, canManage }`.
 *
 * Errors/failure modes:
 * - `create` throws when unauthenticated, missing scopes, or when IEE (SafeApprove) approval fails/cancels.
 * - Network errors surface via `error`.
 *
 * Side effects:
 * - Issues a POST request to apps/api (with IEE (SafeApprove) receipt), persists a contact record, and invalidates the `contacts` resource.
 *
 * Invariants/assumptions:
 * - `email` should be a valid email string when sent to the API.
 *
 * Data/auth references:
 * - `/api/v1/contacts` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { create } = useCreateContact();
 * const contact = await create({ email: "a@b.com", name: "Alice" }, { receipt });
 *
 * @see ContactsService
 * @see /api/v1/contacts
 */
export declare const useCreateContact: () => {
    create: (input: CreateContactInput, options?: {
        receipt?: string | null;
    }) => Promise<Contact>;
    isLoading: boolean;
    error: Error | null;
    canManage: boolean;
};
/**
 * Updates an existing personal contact.
 *
 * @remarks
 * Purpose:
 * - Update contact fields for the authenticated user.
 *
 * - Backed by `PATCH /api/v1/contacts/:contactId`.
 * - Requires `contacts:manage` scope.
 *
 * When to use:
 * - Use when updating contact details in user address books.
 *
 * When not to use:
 * - Do not use when unauthenticated or missing contacts:manage scope.
 *
 * Parameters:
 * - None. Hook-only; call `update(...)` to execute.
 *
 * Return semantics:
 * - Returns `{ update, isLoading, error, canManage }`.
 *
 * Errors/failure modes:
 * - `update` throws when unauthenticated, missing scopes, or when IEE (SafeApprove) approval fails/cancels.
 * - Network errors surface via `error`.
 *
 * Side effects:
 * - Issues a PATCH request to apps/api (with IEE (SafeApprove) receipt), updates a contact record, and invalidates the `contacts` resource.
 *
 * Invariants/assumptions:
 * - `contactId` must be a UUID string.
 *
 * Data/auth references:
 * - `/api/v1/contacts/:contactId` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { update } = useUpdateContact();
 * const updated = await update("uuid", { name: "New Name" }, { receipt });
 *
 * @see ContactsService
 * @see /api/v1/contacts/:contactId
 */
export declare const useUpdateContact: () => {
    update: (contactId: string, input: UpdateContactInput, options?: {
        receipt?: string | null;
    }) => Promise<Contact>;
    isLoading: boolean;
    error: Error | null;
    canManage: boolean;
};
/**
 * Deletes an existing personal contact.
 *
 * @remarks
 * Purpose:
 * - Delete a contact record for the authenticated user.
 *
 * - Backed by `DELETE /api/v1/contacts/:contactId`.
 * - Requires `contacts:manage` scope.
 *
 * When to use:
 * - Use when removing contacts from a user's address book.
 *
 * When not to use:
 * - Do not use when unauthenticated or missing contacts:manage scope.
 *
 * Parameters:
 * - None. Hook-only; call `remove(...)` to execute.
 *
 * Return semantics:
 * - Returns `{ remove, isLoading, error, canManage }`.
 *
 * Errors/failure modes:
 * - `remove` throws when unauthenticated, missing scopes, or when IEE (SafeApprove) approval fails/cancels.
 * - Network errors surface via `error`.
 *
 * Side effects:
 * - Issues a DELETE request to apps/api (with IEE (SafeApprove) receipt), removes a contact record, and invalidates the `contacts` resource.
 *
 * Invariants/assumptions:
 * - `contactId` must be a UUID string.
 *
 * Data/auth references:
 * - `/api/v1/contacts/:contactId` (apps/api, bearer token + IEE (SafeApprove) receipt).
 *
 * @example
 * const { remove } = useDeleteContact();
 * await remove("uuid", { receipt });
 *
 * @see ContactsService
 * @see /api/v1/contacts/:contactId
 */
export declare const useDeleteContact: () => {
    remove: (contactId: string, options?: {
        receipt?: string | null;
    }) => Promise<DeleteContactResult>;
    isLoading: boolean;
    error: Error | null;
    canManage: boolean;
};
