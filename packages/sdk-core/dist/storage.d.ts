/**
 * Minimal async storage contract used by the SDK.
 *
 * @remarks
 * Purpose:
 * - Define the storage adapter interface for token and session persistence.
 *
 * When to use:
 * - Implement when integrating the SDK with custom storage backends.
 *
 * When not to use:
 * - Do not implement if you can use the built-in MemoryStorage or a known storage adapter.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Interface only; no runtime behavior.
 *
 * Errors/failure modes:
 * - Implementations may throw on storage failures.
 *
 * Side effects:
 * - Implementations may persist or delete data.
 *
 * Invariants/assumptions:
 * - `key` and `value` are UTF-8 strings.
 *
 * Data/auth references:
 * - Used to store OAuth tokens and session metadata.
 */
export interface AuthStorageAdapter {
    /**
     * Read a raw string value by key.
     *
     * @remarks
     * Purpose:
     * - Provide a minimal async read contract for SDK storage.
     *
     * Parameters:
     * - `key`: Storage key (string, required). Nullable: no.
     *
     * Return semantics:
     * - Resolves with the stored string or null when missing.
     *
     * Errors/failure modes:
     * - Implementations may throw storage-specific errors.
     *
     * Side effects:
     * - None.
     *
     * Invariants/assumptions:
     * - `key` is treated as an opaque identifier.
     *
     * Data/auth references:
     * - Stored values may include serialized OAuth tokens.
     */
    getItem(key: string): Promise<string | null>;
    /**
     * Persist a raw string value by key.
     *
     * @remarks
     * Purpose:
     * - Provide a minimal async write contract for SDK storage.
     *
     * Parameters:
     * - `key`: Storage key (string, required). Nullable: no.
     * - `value`: Serialized payload (string, required). Nullable: no.
     *
     * Return semantics:
     * - Resolves with void on success.
     *
     * Errors/failure modes:
     * - Implementations may throw storage-specific errors.
     *
     * Side effects:
     * - Persists data in the backing store.
     *
     * Invariants/assumptions:
     * - `value` is expected to be JSON when used by AuthStorage.
     *
     * Data/auth references:
     * - Stored values may include serialized OAuth tokens.
     */
    setItem(key: string, value: string): Promise<void>;
    /**
     * Remove a stored value by key.
     *
     * @remarks
     * Purpose:
     * - Provide a minimal async delete contract for SDK storage.
     *
     * Parameters:
     * - `key`: Storage key (string, required). Nullable: no.
     *
     * Return semantics:
     * - Resolves with void on success.
     *
     * Errors/failure modes:
     * - Implementations may throw storage-specific errors.
     *
     * Side effects:
     * - Deletes persisted data in the backing store.
     *
     * Invariants/assumptions:
     * - Missing keys should be treated as no-ops.
     *
     * Data/auth references:
     * - Stored values may include serialized OAuth tokens.
     */
    removeItem(key: string): Promise<void>;
}
/**
 * Default in-memory adapter. Useful for SSR and tests.
 *
 * @remarks
 * Purpose:
 * - Provide a simple, ephemeral storage adapter for non-browser contexts.
 *
 * When to use:
 * - Use for SSR, tests, or short-lived sessions that should not persist across reloads.
 *
 * When not to use:
 * - Do not use when you need durable persistence across page reloads or server restarts.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - In-memory storage adapter instance.
 *
 * Errors/failure modes:
 * - None (Map-based operations are synchronous and should not throw).
 *
 * Side effects:
 * - Stores values in memory for the lifetime of the instance.
 *
 * Invariants/assumptions:
 * - Data is cleared when the process or page reloads.
 *
 * Data/auth references:
 * - Stores OAuth tokens when used by AuthStorage.
 */
export declare class MemoryStorage implements AuthStorageAdapter {
    private store;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
/**
 * Namespaced storage wrapper used by OAuthService.
 *
 * @remarks
 * Purpose:
 * - Provide consistent key namespacing and JSON serialization for tokens.
 *
 * When to use:
 * - Use when you need an SDK-compatible storage wrapper around a custom adapter.
 *
 * When not to use:
 * - Do not use if you already have a higher-level SDK client that manages storage.
 *
 * Parameters:
 * - `adapter`: Storage adapter implementation. Nullable: no.
 * - `prefix`: Key prefix for namespacing. Nullable: yes.
 * - `tenantId`: Optional tenant ID for per-tenant key scoping. Nullable: yes.
 *
 * Return semantics:
 * - Constructs a namespaced storage wrapper.
 *
 * Errors/failure modes:
 * - Throws ValidationError when adapter is missing.
 *
 * Side effects:
 * - Reads/writes to the underlying adapter during read/write calls.
 *
 * Invariants/assumptions:
 * - Values are stored as JSON strings.
 *
 * Data/auth references:
 * - Stores OAuth TokenSet and session metadata.
 */
export declare class AuthStorage {
    private adapter;
    private prefix;
    private tenantId?;
    constructor(adapter: AuthStorageAdapter, prefix?: string, tenantId?: string | undefined);
    private key;
    read<T>(key: string): Promise<T | null>;
    write<T>(key: string, value: T | null): Promise<void>;
}
/**
 * Convenience factory that provides a deterministic, runtime-safe storage.
 *
 * @remarks
 * Purpose:
 * - Returns a pure in-memory AuthStorage instance for all environments.
 *
 * When to use:
 * - Use for server-side or test environments where persistence is not required.
 *
 * When not to use:
 * - Do not use if you need tokens to survive reloads; supply a persistent adapter instead.
 *
 * Parameters:
 * - `prefix`: Optional key prefix for storage namespacing. Nullable: yes.
 * - `tenantId`: Optional tenant ID for storage namespacing. Nullable: yes.
 *
 * Return semantics:
 * - Returns AuthStorage backed by MemoryStorage.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None (memory-only storage).
 *
 * Invariants/assumptions:
 * - Storage clears on reload; callers must opt into browser persistence elsewhere.
 *
 * Data/auth references:
 * - Stores OAuth tokens in memory only.
 */
export declare const createDefaultStorage: (prefix?: string, tenantId?: string) => AuthStorage;
