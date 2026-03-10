import { ValidationError } from "./errors.js";
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
export class MemoryStorage {
    constructor() {
        this.store = new Map();
    }
    async getItem(key) {
        return this.store.get(key) ?? null;
    }
    async setItem(key, value) {
        this.store.set(key, value);
    }
    async removeItem(key) {
        this.store.delete(key);
    }
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
export class AuthStorage {
    constructor(adapter, prefix = "xkova:sdk", tenantId) {
        this.adapter = adapter;
        this.prefix = prefix;
        this.tenantId = tenantId;
        if (!adapter) {
            throw new ValidationError("AuthStorage requires an adapter");
        }
    }
    key(suffix) {
        return this.tenantId
            ? `${this.prefix}:${this.tenantId}:${suffix}`
            : `${this.prefix}:${suffix}`;
    }
    async read(key) {
        const value = await this.adapter.getItem(this.key(key));
        if (!value)
            return null;
        try {
            return JSON.parse(value);
        }
        catch {
            await this.adapter.removeItem(this.key(key));
            return null;
        }
    }
    async write(key, value) {
        const namespaced = this.key(key);
        if (value === null) {
            await this.adapter.removeItem(namespaced);
            return;
        }
        await this.adapter.setItem(namespaced, JSON.stringify(value));
    }
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
export const createDefaultStorage = (prefix, tenantId) => new AuthStorage(new MemoryStorage(), prefix, tenantId);
