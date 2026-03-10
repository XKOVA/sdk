import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ContactsService,
  type Contact,
  type ContactsListQuery,
  type ContactsListResponse,
  type CreateContactInput,
  type UpdateContactInput,
  type DeleteContactResult,
} from "@xkova/sdk-core";
import { useSDK } from "./provider.js";
import { emitResourceUpdate, subscribeResourceUpdate } from "./resources.js";
import { resolvePollingFallbackMs } from "./realtime.js";

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
export const useContacts = (
  filter?: ContactsListQuery & {
    autoRefreshMs?: number;
  },
) => {
  const { apiClient, state, iee, realtime } = useSDK();
  const autoRefreshMs = resolvePollingFallbackMs(filter?.autoRefreshMs, realtime);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const service = useMemo(
    () => new ContactsService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const scopes = state.tokens?.scope ?? [];
  const canRead =
    scopes.includes("all") ||
    scopes.includes("contacts:read") ||
    scopes.includes("contacts:manage");
  const canManage = scopes.includes("all") || scopes.includes("contacts:manage");

  const fetch = useCallback(async () => {
    if (state.status !== "authenticated") return;

    if (!canRead) {
      setContacts([]);
      setTotal(0);
      setCount(0);
      setSearchQuery(filter?.query);
      setFavoritesOnly(Boolean(filter?.favoritesOnly));
      setError(new Error("Insufficient scope. Required: contacts:read (all)"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response: ContactsListResponse = await service.listContacts({
        query: filter?.query,
        favoritesOnly: filter?.favoritesOnly,
        limit: filter?.limit,
        offset: filter?.offset,
      });

      if (controller.signal.aborted) return;

      const list = response.contacts || [];
      setContacts(list);
      setTotal(Number(response.total ?? 0));
      setCount(Number(response.count ?? list.length));
      setSearchQuery(response.searchQuery);
      setFavoritesOnly(response.favoritesOnly);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err as Error);
    } finally {
      if (controller.signal.aborted) return;
      setIsLoading(false);
    }
  }, [
    canRead,
    filter?.favoritesOnly,
    filter?.limit,
    filter?.offset,
    filter?.query,
    service,
    state.status,
  ]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!autoRefreshMs || state.status !== "authenticated") return;
    const interval = setInterval(() => {
      fetch();
    }, autoRefreshMs);
    return () => clearInterval(interval);
  }, [autoRefreshMs, fetch, state.status]);

  const refetch = useCallback(() => fetch(), [fetch]);

  useEffect(() => {
    return subscribeResourceUpdate("contacts", () => {
      void refetch();
    });
  }, [refetch]);

  return {
    contacts,
    total,
    count,
    searchQuery,
    favoritesOnly,
    isLoading,
    error,
    refetch,
    canRead,
    canManage,
  };
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
export const useCreateContact = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(
    () => new ContactsService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const scopes = state.tokens?.scope ?? [];
  const canManage = scopes.includes("all") || scopes.includes("contacts:manage");

  const create = useCallback(
    async (input: CreateContactInput, options?: { receipt?: string | null }): Promise<Contact> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      if (!canManage) {
        throw new Error("Insufficient scope. Required: contacts:manage (all)");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.createContact(input, options);
        emitResourceUpdate("contacts");
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [canManage, service, state.status],
  );

  return { create, isLoading, error, canManage };
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
export const useUpdateContact = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(
    () => new ContactsService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const scopes = state.tokens?.scope ?? [];
  const canManage = scopes.includes("all") || scopes.includes("contacts:manage");

  const update = useCallback(
    async (
      contactId: string,
      input: UpdateContactInput,
      options?: { receipt?: string | null },
    ): Promise<Contact> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      if (!canManage) {
        throw new Error("Insufficient scope. Required: contacts:manage (all)");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.updateContact(contactId, input, options);
        emitResourceUpdate("contacts");
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [canManage, service, state.status],
  );

  return { update, isLoading, error, canManage };
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
export const useDeleteContact = () => {
  const { apiClient, state, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(
    () => new ContactsService({ client: apiClient, iee }),
    [apiClient, iee],
  );

  const scopes = state.tokens?.scope ?? [];
  const canManage = scopes.includes("all") || scopes.includes("contacts:manage");

  const remove = useCallback(
    async (
      contactId: string,
      options?: { receipt?: string | null },
    ): Promise<DeleteContactResult> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      if (!canManage) {
        throw new Error("Insufficient scope. Required: contacts:manage (all)");
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await service.deleteContact(contactId, options);
        emitResourceUpdate("contacts");
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [canManage, service, state.status],
  );

  return { remove, isLoading, error, canManage };
};
