import { BadResponseError, ValidationError, } from './errors.js';
import { IeeOrchestrator } from './iee-orchestration.js';
import { mapTenantResponse } from './oauth.js';
import { normalizeInstallInputs } from './agents/install-questions.js';
class BaseService {
    constructor(options) {
        this.client = options.client;
        this.iee =
            options.iee ?? new IeeOrchestrator({ requireExplicitReceipt: true });
    }
    async ensureIeeReceipt(params) {
        return this.iee.ensureReceipt(params);
    }
}
const normalizeRampProviderId = (providerId) => {
    const trimmed = String(providerId ?? '').trim();
    if (!trimmed)
        return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower === 'faucet' || lower === 'usdc_faucet')
        return 'usdc-faucet';
    return trimmed;
};
/**
 * Map raw OAuth account descriptor payload to SDK shape.
 *
 * @remarks
 * - Accepts snake_case payloads from OAuth responses.
 *
 * @param payload - Raw account descriptor payload (nullable).
 * @returns Canonical account descriptor.
 * @errors None.
 * @sideEffects None.
 * @invariants Returns empty strings when required fields are missing.
 */
const mapAccountDescriptor = (payload) => ({
    name: payload?.name ?? '',
    kind: payload?.kind ?? 'account',
    account: payload?.account ?? '',
    providerInstanceId: payload?.provider_instance_id ?? null,
    aaProviderMetadata: payload?.aa_provider_metadata ?? {},
    metadata: payload?.metadata ?? {},
});
/**
 * Map raw OAuth account state payload to SDK shape.
 *
 * @remarks
 * - Supports `account` from `/account`.
 *
 * @param payload - Raw account state payload (nullable).
 * @returns Canonical account state.
 * @errors None.
 * @sideEffects None.
 * @invariants `account` is always present.
 */
const mapAccountState = (payload) => ({
    account: mapAccountDescriptor(payload?.account ?? {}),
});
/**
 * Map raw OAuth user payload to SDK shape.
 *
 * @remarks
 * - Normalizes snake_case fields from `/oauth/user`.
 *
 * @param payload - Raw user payload (nullable).
 * @returns Canonical user info.
 * @errors None.
 * @sideEffects None.
 * @invariants `account` is always present.
 */
const mapUserResponse = (payload) => ({
    id: payload?.sub ?? '',
    email: payload?.email ?? '',
    emailVerified: Boolean(payload?.email_verified),
    firstName: payload?.first_name ?? null,
    lastName: payload?.last_name ?? null,
    name: payload?.name ?? null,
    handle: payload?.handle ?? null,
    avatarUrl: payload?.avatar_url ?? null,
    completeProfile: Boolean(payload?.complete_profile),
    account: mapAccountDescriptor(payload?.account ?? {}),
    tenantId: payload?.tenant_id ?? null,
    tenantSlug: payload?.tenant_slug ?? null,
    tenantName: payload?.tenant_name ?? null,
    scope: typeof payload?.scope === 'string' ? payload.scope : null,
    createdAt: payload?.created_at ?? null,
    updatedAt: payload?.updated_at ?? null,
});
/**
 * Account service for OAuth `/account` endpoints.
 *
 * @remarks
 * Purpose:
 * - Provide low-level access to account state.
 *
 * When to use:
 * - Use in headless or custom integrations that call `/account` directly.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useAccountState/useAccountActions) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests when methods are called.
 *
 * Invariants/assumptions:
 * - APIClient baseUrl must point to the OAuth protocol host.
 *
 * Data/auth references:
 * - /account endpoint.
 *
 * @advanced
 */
export class AccountService extends BaseService {
    /**
     * Fetches account state for the authenticated user.
     *
     * @param _none - No parameters; uses bearer token from API client.
     * @returns Canonical account state.
     * @errors Network/authorization errors from the API client.
     * @sideEffects None.
     * @invariants `account` is always present in the response.
     */
    async getAccountState() {
        const raw = await this.client.get('/account');
        return mapAccountState(raw);
    }
}
/**
 * Tenant bootstrap service for `/oauth/user` and `/oauth/tenant`.
 *
 * @remarks
 * Purpose:
 * - Fetch user and tenant bootstrap payloads without instantiating OAuthService.
 *
 * When to use:
 * - Use when you already have an APIClient bound to oauth-server.
 *
 * When not to use:
 * - Prefer OAuthService.fetchBootstrap for storage-aware OAuth sessions.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests to fetch bootstrap data.
 *
 * Invariants/assumptions:
 * - APIClient baseUrl must point to the OAuth protocol host.
 *
 * Data/auth references:
 * - /oauth/user and /oauth/tenant endpoints.
 *
 * @advanced
 */
export class TenantConfigService extends BaseService {
    /**
     * Retrieves bootstrap data (user, tenant, networks, tokens).
     * @scope openid profile email account:read
     */
    async getBootstrap() {
        const user = await this.client.get('/oauth/user');
        const tenant = await this.client.get('/oauth/tenant');
        const mappedTenant = mapTenantResponse(tenant);
        return {
            user: mapUserResponse(user),
            tenant: mappedTenant,
            networks: mappedTenant.networks,
            tokens: mappedTenant.tokens,
            accountState: null,
            tokenMeta: {
                scope: typeof user?.scope === 'string'
                    ? user.scope.split(' ')
                    : Array.isArray(user?.scope)
                        ? user.scope
                        : [],
            },
        };
    }
    /** Convenience accessor for tenant configuration only. */
    async getTenant() {
        const payload = await this.getBootstrap();
        return payload.tenant;
    }
    /** Returns network-aware token metadata from bootstrap. */
    async getTokens() {
        const payload = await this.getBootstrap();
        return payload.tokens;
    }
}
/**
 * User profile service for `/oauth/user`.
 *
 * @remarks
 * Purpose:
 * - Read and update the authenticated user's profile fields.
 *
 * When to use:
 * - Use in headless integrations that need profile data outside React hooks.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useUserProfile) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests for profile reads/updates.
 *
 * Invariants/assumptions:
 * - APIClient baseUrl must point to the OAuth protocol host.
 *
 * Data/auth references:
 * - /oauth/user endpoint.
 *
 * @advanced
 */
export class UserProfileService extends BaseService {
    /**
     * Reads the authenticated user's profile.
     * @scope account:read
     */
    async getProfile() {
        const raw = await this.client.get('/oauth/user');
        return mapUserResponse(raw);
    }
    /**
     * Updates the authenticated user's profile.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `profile_update_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Profile updates.
     * @param options - Receipt override (optional).
     * @scope account:manage
     */
    async updateProfile(input, options) {
        if (input.firstName === undefined &&
            input.lastName === undefined &&
            input.avatarPath === undefined) {
            throw new ValidationError('At least one profile field must be provided');
        }
        const payload = {
            first_name: input.firstName,
            last_name: input.lastName,
            avatar_path: input.avatarPath,
        };
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'profile_update',
            payload: {
                first_name: payload.first_name ?? '',
                last_name: payload.last_name ?? '',
                avatar_path: payload.avatar_path === undefined || payload.avatar_path === null
                    ? ''
                    : String(payload.avatar_path),
            },
            receipt: options?.receipt,
        });
        const raw = await this.client.put('/oauth/user', payload, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
        return mapUserResponse(raw);
    }
    /**
     * Creates a signed avatar upload ticket.
     *
     * @remarks
     * - Returns a signed upload URL plus storage path.
     * - Requires an IEE (SafeApprove) receipt header for third-party writes.
     *
     * @scope account:manage
     */
    async createAvatarUpload(options) {
        const payload = {
            first_name: '',
            last_name: '',
            avatar_path: '',
        };
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'profile_update',
            payload,
            receipt: options?.receipt,
        });
        const raw = await this.client.post('/oauth/user/avatar/upload', undefined, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
        const ticket = {
            bucket: raw?.bucket ?? '',
            path: raw?.path ?? '',
            uploadUrl: raw?.upload_url ?? '',
            token: raw?.token ?? '',
            expiresIn: typeof raw?.expires_in === 'number' ? raw.expires_in : undefined,
        };
        if (!ticket.uploadUrl || !ticket.path) {
            throw new Error('Invalid avatar upload ticket');
        }
        return ticket;
    }
    /**
     * Uploads an avatar file and updates the profile.
     *
     * @remarks
     * - Performs a signed upload, then calls `PUT /oauth/user` with `avatar_path`.
     * - Requires IEE (SafeApprove) approval for `profile_update_v1`.
     * - When third-party writes are enabled, upload ticket creation also requires IEE approval.
     *
     * @param file - Avatar file contents.
     * @param options - Upload options (optional).
     * @scope account:manage
     */
    async uploadAvatar(file, options) {
        const avatarPath = options?.avatarPath;
        let receipt = options?.receipt ?? null;
        if (!receipt && avatarPath) {
            const { receipt: derived } = await this.ensureIeeReceipt({
                actionType: 'profile_update',
                payload: {
                    first_name: '',
                    last_name: '',
                    avatar_path: avatarPath,
                },
            });
            receipt = derived;
        }
        const ticket = await this.createAvatarUpload({ receipt });
        if (avatarPath && ticket.path && ticket.path !== avatarPath) {
            throw new Error('Avatar upload path mismatch');
        }
        await this.uploadToSignedUrl(ticket.uploadUrl, file, options);
        return this.updateProfile({ avatarPath: ticket.path }, { receipt });
    }
    async uploadToSignedUrl(uploadUrl, file, options) {
        const fetchImpl = options?.fetch ?? globalThis.fetch;
        if (!fetchImpl) {
            throw new Error('fetch is not available for avatar upload');
        }
        let body;
        const headers = {
            'x-upsert': 'true',
        };
        if (typeof FormData !== 'undefined' && file instanceof FormData) {
            body = file;
        }
        else {
            if (typeof Blob === 'undefined') {
                throw new Error('Blob is not available; provide a FormData upload body');
            }
            const blobInput = (() => {
                if (typeof Blob !== 'undefined' && file instanceof Blob) {
                    return file;
                }
                if (file instanceof Uint8Array) {
                    // Copy into a new ArrayBuffer to avoid SharedArrayBuffer typing issues.
                    const copy = new Uint8Array(file.byteLength);
                    copy.set(file);
                    return copy.buffer;
                }
                return file;
            })();
            const blob = blobInput instanceof Blob
                ? blobInput
                : new Blob([blobInput], {
                    type: options?.contentType ?? 'application/octet-stream',
                });
            const form = new FormData();
            // Supabase storage expects an unnamed field for signed uploads.
            form.append('', blob);
            body = form;
        }
        const response = await fetchImpl(uploadUrl, {
            method: 'PUT',
            headers,
            body,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text
                ? `Avatar upload failed: ${text}`
                : `Avatar upload failed with status ${response.status}`);
        }
    }
}
/**
 * IEE (SafeApprove) ticket service for issuing prep tickets (oauth-server).
 *
 * @remarks
 * Purpose:
 * - Mint short-lived, single-use IEE (SafeApprove) prep tickets bound to an action_type + payload.
 *
 * When to use:
 * - Use prior to launching the oauth-server IEE (SafeApprove) iframe modal.
 *
 * When not to use:
 * - Do not use for commit endpoints; this only issues tickets.
 *
 * Return semantics:
 * - Returns ticket id + expiry timestamp.
 *
 * Errors/failure modes:
 * - Propagates HTTP/validation errors from oauth-server.
 *
 * Side effects:
 * - Persists a prep ticket in oauth-server (Supabase) for later redemption by the IEE (SafeApprove).
 *
 * Invariants/assumptions:
 * - Caller is authenticated (user access token) and has required scopes for the action_type.
 */
export class IeeService extends BaseService {
    /**
     * Issue a short-lived IEE (SafeApprove) prep ticket.
     */
    async createPrepTicket(input) {
        const payload = {
            action_type: input.actionType,
            payload: input.payload,
        };
        if (typeof input.expiresInSeconds === 'number') {
            payload['expires_in_seconds'] = input.expiresInSeconds;
        }
        const response = await this.client.post('/iee/tickets', payload);
        return {
            ticketId: response.ticket_id,
            expiresAt: response.expires_at,
        };
    }
}
/**
 * Session management helpers around oauth-server `/tenant/sessions`.
 *
 * @remarks
 * Purpose:
 * - List and revoke user sessions with bearer-authenticated calls.
 *
 * When to use:
 * - Use in BFF/app-session patterns where you have access to bearer tokens.
 *
 * When not to use:
 * - Prefer OAuthService.logout or SDK provider flows for standard sign-out.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Revokes sessions server-side when requested.
 *
 * Invariants/assumptions:
 * - The server forbids revoking the current session.
 * - Scopes required: `account:read` (list) and `account:manage` (revoke).
 *
 * Data/auth references:
 * - /tenant/sessions and /tenant/sessions/others endpoints.
 *
 * @advanced
 */
export class SessionManagementService extends BaseService {
    /**
     * List all active sessions for the current user.
     *
     * @param options - Optional pagination options.
     * @param options.limit - Page size (1-200). When omitted, the server default is used.
     * @param options.offset - Pagination offset (>= 0). When omitted, the server default is used.
     * @returns Normalized session list payload.
     * @errors Network/authorization errors from the OAuth server.
     * @sideEffects Performs a network request to oauth-server.
     * @invariants `sessions` is always an array.
     */
    async listSessions(options) {
        const params = new URLSearchParams();
        const limit = options?.limit;
        const offset = options?.offset;
        if (typeof limit === 'number' && Number.isFinite(limit)) {
            const normalized = Math.floor(limit);
            if (normalized > 0)
                params.set('limit', String(normalized));
        }
        if (typeof offset === 'number' && Number.isFinite(offset)) {
            const normalized = Math.floor(offset);
            if (normalized >= 0)
                params.set('offset', String(normalized));
        }
        const path = params.toString().length > 0
            ? `/tenant/sessions?${params.toString()}`
            : '/tenant/sessions';
        const raw = await this.client.get(path);
        const container = raw?.data ?? raw;
        const sessionsRaw = container?.sessions;
        const sessionsList = Array.isArray(sessionsRaw) ? sessionsRaw : [];
        /**
         * True when the input is a non-null object.
         */
        const isRecord = (value) => typeof value === 'object' && value !== null;
        /**
         * Returns a trimmed, non-empty string; otherwise returns null.
         */
        const asNonEmptyString = (value) => {
            if (typeof value !== 'string')
                return null;
            const v = value.trim();
            return v.length > 0 ? v : null;
        };
        /**
         * Best-effort conversion for JSON timestamp fields into strings.
         *
         * @remarks
         * - oauth-server emits Dates which serialize as ISO 8601 strings.
         * - If the value is not representable, returns an empty string.
         */
        const asIsoString = (value) => {
            if (typeof value === 'string')
                return value;
            if (value instanceof Date)
                return value.toISOString();
            return '';
        };
        /**
         * Normalize device type values into the SDK union.
         */
        const asDeviceType = (value) => {
            if (value === 'mobile' || value === 'tablet' || value === 'desktop')
                return value;
            return 'unknown';
        };
        /**
         * Maps an upstream session entry into an SDK `UserSession`.
         *
         * @remarks
         * - Drops malformed rows by returning null.
         */
        const mapSession = (value) => {
            if (!isRecord(value))
                return null;
            const sessionId = asNonEmptyString(value.sessionId);
            if (!sessionId)
                return null;
            const device = isRecord(value.device) ? value.device : {};
            const location = isRecord(value.location) ? value.location : {};
            const activity = isRecord(value.activity) ? value.activity : {};
            const security = isRecord(value.security) ? value.security : {};
            return {
                sessionId,
                device: {
                    type: asDeviceType(device.type),
                    browser: asNonEmptyString(device.browser) ?? 'Unknown',
                    os: asNonEmptyString(device.os) ?? 'Unknown',
                    description: asNonEmptyString(device.description) ?? 'Unknown device',
                },
                location: {
                    city: asNonEmptyString(location.city) ?? undefined,
                    region: asNonEmptyString(location.region) ?? undefined,
                    country: asNonEmptyString(location.country) ?? undefined,
                    display: asNonEmptyString(location.display) ?? 'Unknown location',
                },
                activity: {
                    createdAt: asIsoString(activity.createdAt),
                    lastActiveAt: asIsoString(activity.lastActiveAt),
                    isCurrentSession: activity.isCurrentSession === true,
                },
                security: {
                    ipAddress: asNonEmptyString(security.ipAddress) ?? '',
                    clientId: asNonEmptyString(security.clientId) ?? '',
                },
            };
        };
        const sessions = sessionsList
            .map(mapSession)
            .filter((s) => Boolean(s));
        const total = typeof container?.total === 'number'
            ? Number(container.total)
            : sessions.length;
        const currentSessionId = asNonEmptyString(container?.currentSessionId) ?? null;
        const resolvedLimit = typeof container?.limit === 'number'
            ? Number(container.limit)
            : typeof limit === 'number' && Number.isFinite(limit)
                ? Math.floor(limit)
                : sessions.length;
        const resolvedOffset = typeof container?.offset === 'number'
            ? Number(container.offset)
            : typeof offset === 'number' && Number.isFinite(offset)
                ? Math.floor(offset)
                : 0;
        return {
            sessions,
            total,
            currentSessionId,
            limit: resolvedLimit,
            offset: resolvedOffset,
        };
    }
    /**
     * Revoke a specific session for the current user.
     *
     * @remarks
     * - The server forbids revoking the current session.
     * - Requires an IEE (SafeApprove) receipt header for `session_revoke_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param sessionId - Session UUID to revoke.
     * @returns Revocation result payload.
     * @errors Throws when `sessionId` is empty, IEE (SafeApprove) validation fails, or OAuth rejects the request.
     * @sideEffects Revokes the session server-side.
     * @invariants Does not revoke the current session (server-enforced).
     */
    async revokeSession(sessionId, options) {
        const id = String(sessionId ?? '').trim();
        if (!id) {
            throw new ValidationError('sessionId is required');
        }
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'session_revoke',
            payload: { session_id: id },
            receipt: options?.receipt,
        });
        const payload = await this.client.delete(`/tenant/sessions/${encodeURIComponent(id)}`, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
        return {
            success: Boolean(payload?.success),
            message: String(payload?.message ?? ''),
            revokedSessionId: String(payload?.revokedSessionId ?? id),
        };
    }
    /**
     * Revoke all sessions except the current one ("sign out of other devices").
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `session_revoke_others_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @returns Revocation result payload.
     * @errors OAuth errors when the token is missing required scopes or IEE (SafeApprove) validation fails.
     * @sideEffects Revokes sessions server-side.
     * @invariants The current session is preserved.
     */
    async revokeOtherSessions(options) {
        const sessionSnapshot = await this.listSessions({ limit: 1, offset: 0 });
        const currentSessionId = sessionSnapshot.currentSessionId;
        if (!currentSessionId) {
            throw new ValidationError('currentSessionId is required to revoke other sessions');
        }
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'session_revoke_others',
            payload: { current_session_id: currentSessionId },
            receipt: options?.receipt,
        });
        const payload = await this.client.delete('/tenant/sessions/others', {
            headers: { 'X-XKOVA-IEE-Receipt': receipt },
        });
        return {
            success: Boolean(payload?.success),
            message: String(payload?.message ?? ''),
            revokedCount: typeof payload?.revokedCount === 'number'
                ? Number(payload.revokedCount)
                : 0,
            currentSessionId: typeof payload?.currentSessionId === 'string'
                ? payload.currentSessionId
                : null,
        };
    }
}
/**
 * Contacts service for `/api/v1/contacts` endpoints (apps/api).
 *
 * @remarks
 * Purpose:
 * - CRUD operations for the authenticated user's personal contacts.
 *
 * When to use:
 * - Use in headless or custom SDK integrations that call contacts endpoints directly.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useContacts/useCreateContact/etc.) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for contact CRUD operations.
 *
 * Invariants/assumptions:
 * - Uses offset pagination (`limit`/`offset`) for list/search endpoints.
 * - Read operations require `contacts:read`; mutations require `contacts:manage`.
 *
 * Data/auth references:
 * - apps/api: `/api/v1/contacts`.
 *
 * @see /api/v1/contacts
 *
 * @advanced
 */
export class ContactsService extends BaseService {
    /**
     * Lists the authenticated user's contacts.
     *
     * @remarks
     * - Backed by `GET /api/v1/contacts`.
     * - Supports search via `query` (matches name/email).
     *
     * @param query - Optional search and pagination parameters.
     * @returns Contacts list response.
     * @errors Network/authorization errors from the API client.
     * @sideEffects Performs a network request to apps/api.
     * @invariants `contacts` is always an array.
     */
    async listContacts(query = {}) {
        const search = new URLSearchParams();
        const q = typeof query.query === 'string' ? query.query.trim() : '';
        if (q)
            search.set('query', q);
        // Legacy-compatible field; current apps/api ignores favorites.
        if (typeof query.favoritesOnly === 'boolean') {
            search.set('favoritesOnly', query.favoritesOnly ? 'true' : 'false');
        }
        if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
            const normalized = Math.floor(query.limit);
            if (normalized > 0)
                search.set('limit', String(Math.min(normalized, 100)));
        }
        if (typeof query.offset === 'number' && Number.isFinite(query.offset)) {
            const normalized = Math.floor(query.offset);
            if (normalized >= 0)
                search.set('offset', String(normalized));
        }
        const path = `/contacts${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Searches contacts using the primary contacts list route.
     *
     * @remarks
     * - Backed by `GET /api/v1/contacts`.
     * - `GET /api/v1/contacts/search` has been removed; this is now an alias for `listContacts`.
     *
     * @param query - Optional search and pagination parameters.
     * @returns Contacts list response.
     * @errors Network/authorization errors from the API client.
     * @sideEffects Performs a network request to apps/api.
     * @invariants `contacts` is always an array.
     */
    async searchContacts(query = {}) {
        return this.listContacts(query);
    }
    /**
     * Retrieves a single contact by id.
     *
     * @remarks
     * - Backed by `GET /api/v1/contacts/:contactId`.
     *
     * @param contactId - Contact UUID (v4).
     * @returns Contact record.
     * @errors Throws when `contactId` is empty or when the API rejects the request.
     * @sideEffects Performs a network request to apps/api.
     * @invariants The returned contact is scoped to the authenticated user (server-enforced).
     */
    async getContactById(contactId) {
        const id = String(contactId ?? '').trim();
        if (!id) {
            throw new ValidationError('contactId is required');
        }
        return this.client.get(`/contacts/${encodeURIComponent(id)}`);
    }
    /**
     * Creates a new contact.
     *
     * @remarks
     * - Backed by `POST /api/v1/contacts`.
     * - Server rejects duplicate emails (case-insensitive) within the user's contact list.
     * - Requires an IEE (SafeApprove) receipt header for `contact_create_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Contact create payload.
     * @returns Created contact record.
     * @errors Throws when `email`/`name` is empty, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Persists a new contact record.
     * @invariants The created record is owned by the authenticated user (server-enforced).
     */
    async createContact(input, options) {
        const email = typeof input?.email === 'string' ? input.email.trim() : '';
        const name = typeof input?.name === 'string' ? input.name.trim() : '';
        if (!email) {
            throw new ValidationError('email is required');
        }
        if (!name) {
            throw new ValidationError('name is required');
        }
        const payload = { email, name };
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'contact_create',
            payload: { email, name },
            receipt: options?.receipt,
        });
        return this.client.post('/contacts', payload, {
            headers: { 'X-XKOVA-IEE-Receipt': receipt },
        });
    }
    /**
     * Updates an existing contact.
     *
     * @remarks
     * - Backed by `PATCH /api/v1/contacts/:contactId`.
     * - Requires an IEE (SafeApprove) receipt header for `contact_update_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param contactId - Contact UUID (v4).
     * @param input - Contact update payload.
     * @returns Updated contact record.
     * @errors Throws when `contactId` is empty, when no fields are provided, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Updates a persisted contact record.
     * @invariants The updated record is owned by the authenticated user (server-enforced).
     */
    async updateContact(contactId, input, options) {
        const id = String(contactId ?? '').trim();
        if (!id) {
            throw new ValidationError('contactId is required');
        }
        const email = typeof input?.email === 'string' ? input.email.trim() : undefined;
        const name = typeof input?.name === 'string' ? input.name.trim() : undefined;
        const payload = {
            ...(email ? { email } : {}),
            ...(name ? { name } : {}),
        };
        if (!payload.email && !payload.name) {
            throw new ValidationError('At least one contact field must be provided');
        }
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'contact_update',
            payload: {
                contact_id: id,
                email: payload.email ?? '',
                name: payload.name ?? '',
            },
            receipt: options?.receipt,
        });
        return this.client.patch(`/contacts/${encodeURIComponent(id)}`, payload, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
    }
    /**
     * Deletes a contact.
     *
     * @remarks
     * - Backed by `DELETE /api/v1/contacts/:contactId`.
     * - Requires an IEE (SafeApprove) receipt header for `contact_delete_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param contactId - Contact UUID (v4).
     * @returns Delete result envelope.
     * @errors Throws when `contactId` is empty, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Deletes a persisted contact record.
     * @invariants The deleted record is owned by the authenticated user (server-enforced).
     */
    async deleteContact(contactId, options) {
        const id = String(contactId ?? '').trim();
        if (!id) {
            throw new ValidationError('contactId is required');
        }
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'contact_delete',
            payload: { contact_id: id },
            receipt: options?.receipt,
        });
        return this.client.delete(`/contacts/${encodeURIComponent(id)}`, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
    }
    /**
     * Performs a bulk operation on contacts.
     *
     * @remarks
     * - Backed by `POST /api/v1/contacts/bulk`.
     * - Bulk delete is supported; favorite operations are accepted but are currently no-ops in apps/api schema.
     * - Requires an IEE (SafeApprove) receipt header for `contact_bulk_operation_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Bulk operation payload.
     * @returns Bulk operation result.
     * @errors Throws when inputs are invalid, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects May delete contacts server-side when `operation=delete`.
     * @invariants The operation is scoped to the authenticated user's contacts (server-enforced).
     */
    async bulkContacts(input, options) {
        const contactIds = Array.isArray(input?.contactIds)
            ? input.contactIds.filter(Boolean)
            : [];
        const operation = String(input?.operation ?? '').trim();
        if (contactIds.length === 0) {
            throw new ValidationError('contactIds is required');
        }
        if (operation !== 'delete' &&
            operation !== 'favorite' &&
            operation !== 'unfavorite') {
            throw new ValidationError('operation must be one of: delete, favorite, unfavorite');
        }
        const payload = {
            contactIds,
            operation: operation,
        };
        const contactIdsCsv = contactIds
            .map((id) => String(id ?? '')
            .trim()
            .toLowerCase())
            .filter(Boolean)
            .sort()
            .join(',');
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'contact_bulk_operation',
            payload: { operation, contact_ids_csv: contactIdsCsv },
            receipt: options?.receipt,
        });
        return this.client.post('/contacts/bulk', payload, {
            headers: { 'X-XKOVA-IEE-Receipt': receipt },
        });
    }
}
/**
 * Transfers service for `/transfers/*` endpoints (apps/api).
 *
 * @remarks
 * Purpose:
 * - Manage deposit/withdraw provider transactions ("transfer activity").
 *
 * When to use:
 * - Use when integrating transfer providers and listing transfer activity.
 *
 * When not to use:
 * - Use TransactionHistoryService for on-chain transaction history.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for transfer transactions.
 *
 * Invariants/assumptions:
 * - Requires `transfers` scope for list/create/update operations.
 *
 * Data/auth references:
 * - /api/v1/transfers/transactions endpoints.
 *
 * @see /api/v1/transfers/transactions
 *
 * @advanced
 */
export class TransfersService extends BaseService {
    /**
     * Lists deposit/withdraw transfer transactions for the authenticated user.
     *
     * @remarks
     * - Uses offset pagination (`limit`/`offset`).
     * - Requires `transfers` scope.
     *
     * @param query - Optional filters and pagination options.
     * @returns Transfer transactions list response.
     * @errors Network/authorization errors from the API client.
     * @sideEffects Performs a network request to apps/api.
     * @invariants `transactions` is always an array.
     */
    async listTransferTransactions(query = {}) {
        const search = new URLSearchParams();
        if (query.type)
            search.set('type', query.type);
        if (query.status)
            search.set('status', query.status);
        if (query.providerId)
            search.set('providerId', query.providerId);
        if (query.networkId)
            search.set('networkId', query.networkId);
        if (query.cryptoSymbol)
            search.set('cryptoSymbol', query.cryptoSymbol);
        if (query.startDate)
            search.set('startDate', query.startDate);
        if (query.endDate)
            search.set('endDate', query.endDate);
        if (typeof query.limit === 'number')
            search.set('limit', String(query.limit));
        if (typeof query.offset === 'number')
            search.set('offset', String(query.offset));
        const path = `/transfers/transactions${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Creates a transfer transaction record (deposit/withdraw provider activity).
     *
     * @remarks
     * - Backed by `POST /api/v1/transfers/transactions`.
     * - Requires `transfers` scope.
     * - Requires an IEE (SafeApprove) receipt header for `transfer_transaction_create_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Transfer transaction create payload.
     * @returns Created transfer transaction.
     * @errors Network/authorization errors from the API client or when IEE (SafeApprove) validation fails.
     * @sideEffects Persists a new transfer transaction record.
     * @invariants `type` is always `deposit` or `withdraw`.
     */
    async createTransferTransaction(input, options) {
        const cryptoAmountWei = typeof input.cryptoAmountWei === 'string'
            ? input.cryptoAmountWei.trim()
            : '';
        if (!cryptoAmountWei) {
            throw new ValidationError('cryptoAmountWei is required to create a transfer transaction');
        }
        const payload = {
            type: input.type,
            providerId: input.providerId,
            networkId: input.networkId,
            account: input.account,
            cryptoSymbol: input.cryptoSymbol,
            fiatCurrency: input.fiatCurrency,
            fiatAmount: input.fiatAmount,
            cryptoAmountWei,
            paymentMethod: input.paymentMethod,
            ...(typeof input.contract === 'string'
                ? { contract: input.contract }
                : {}),
            ...(typeof input.userCountry === 'string'
                ? { userCountry: input.userCountry }
                : {}),
            ...(typeof input.returnUrl === 'string'
                ? { returnUrl: input.returnUrl }
                : {}),
            ...(typeof input.webhookUrl === 'string'
                ? { webhookUrl: input.webhookUrl }
                : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
        };
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'transfer_transaction_create',
            payload: {
                transfer_type: input.type,
                provider_id: normalizeRampProviderId(input.providerId),
                network_id: input.networkId,
                account: input.account,
                crypto_symbol: input.cryptoSymbol,
                fiat_currency: input.fiatCurrency,
                fiat_amount: input.fiatAmount,
                crypto_amount_wei: cryptoAmountWei,
                payment_method: input.paymentMethod,
            },
            receipt: options?.receipt,
        });
        return this.client.post('/transfers/transactions', payload, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
    }
    /**
     * Executes a faucet transfer transaction (single-approval).
     *
     * @remarks
     * - Backed by `POST /api/v1/transfers/transactions/faucet`.
     * - Requires `transfers` scope.
     * - Requires an IEE (SafeApprove) receipt header for `transfer_faucet_execute_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param input - Faucet transfer payload (includes transaction hash).
     * @param options - Receipt header for the faucet execution action.
     * @returns Created transfer transaction.
     * @errors Network/authorization errors from the API client or when IEE (SafeApprove) validation fails.
     * @sideEffects Persists a new transfer transaction record and marks it completed.
     * @invariants `transactionHash` must be a valid transaction hash.
     */
    async executeFaucetTransfer(input, options) {
        const cryptoAmountWei = typeof input.cryptoAmountWei === 'string'
            ? input.cryptoAmountWei.trim()
            : '';
        if (!cryptoAmountWei) {
            throw new ValidationError('cryptoAmountWei is required to execute a faucet transfer');
        }
        const approval = await this.ensureIeeReceipt({
            actionType: 'transfer_faucet_execute',
            payload: {
                transfer_type: input.type,
                provider_id: normalizeRampProviderId(input.providerId),
                network_id: input.networkId,
                account: input.account,
                crypto_symbol: input.cryptoSymbol,
                fiat_currency: input.fiatCurrency,
                fiat_amount: input.fiatAmount,
                crypto_amount_wei: cryptoAmountWei,
                payment_method: input.paymentMethod,
            },
            receipt: options?.receipt,
        });
        const providedTxHash = String(input.transactionHash ?? '').trim();
        const approvalTxHash = String(approval.transactionHash ?? '').trim();
        if (providedTxHash &&
            approvalTxHash &&
            providedTxHash.toLowerCase() !== approvalTxHash.toLowerCase()) {
            throw new ValidationError('transactionHash does not match SafeApprove approval');
        }
        const resolvedTransactionHash = approvalTxHash || providedTxHash;
        if (!resolvedTransactionHash) {
            throw new ValidationError('transactionHash is required to execute a faucet transfer');
        }
        const payload = {
            type: input.type,
            providerId: input.providerId,
            networkId: input.networkId,
            account: input.account,
            cryptoSymbol: input.cryptoSymbol,
            fiatCurrency: input.fiatCurrency,
            fiatAmount: input.fiatAmount,
            cryptoAmountWei,
            paymentMethod: input.paymentMethod,
            ...(typeof input.contract === 'string'
                ? { contract: input.contract }
                : {}),
            ...(typeof input.userCountry === 'string'
                ? { userCountry: input.userCountry }
                : {}),
            ...(typeof input.returnUrl === 'string'
                ? { returnUrl: input.returnUrl }
                : {}),
            ...(typeof input.webhookUrl === 'string'
                ? { webhookUrl: input.webhookUrl }
                : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
            transactionHash: resolvedTransactionHash,
        };
        return this.client.post('/transfers/transactions/faucet', payload, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Updates an existing transfer transaction record with status/hash.
     *
     * @remarks
     * - Backed by `PATCH /api/v1/transfers/transactions/:transactionId`.
     * - Requires `transfers` scope.
     * - Requires an IEE (SafeApprove) receipt header for `transfer_transaction_update_v1`.
     * - Faucet transfers must use `executeFaucetTransfer`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     *
     * @param transactionId - Transfer transaction UUID.
     * @param input - Status/hash update payload.
     * @param options - Receipt header for the update action.
     * @returns Updated transfer transaction.
     * @errors Throws when `transactionId` is empty, IEE (SafeApprove) validation fails, or when the API rejects the request.
     * @sideEffects Updates the persisted transfer transaction record.
     * @invariants `transactionId` must be a UUID.
     */
    async updateTransferTransaction(transactionId, input, options) {
        const id = String(transactionId ?? '').trim();
        if (!id) {
            throw new ValidationError('transactionId is required');
        }
        const payload = {
            status: input.status,
            ...(typeof input.transactionHash === 'string'
                ? { transactionHash: input.transactionHash }
                : {}),
            ...(typeof input.failureReason === 'string'
                ? { failureReason: input.failureReason }
                : {}),
        };
        const { receipt } = await this.ensureIeeReceipt({
            actionType: 'transfer_transaction_update',
            payload: {
                transfer_transaction_id: id,
                status: input.status,
                transaction_hash: typeof input.transactionHash === 'string'
                    ? input.transactionHash
                    : '',
                failure_reason: typeof input.failureReason === 'string' ? input.failureReason : '',
            },
            receipt: options?.receipt,
        });
        return this.client.patch(`/transfers/transactions/${encodeURIComponent(id)}`, payload, { headers: { 'X-XKOVA-IEE-Receipt': receipt } });
    }
}
/**
 * Send payments service for `/api/v1/payments/send`.
 *
 * @remarks
 * Purpose:
 * - Retrieve and manage send payments for the authenticated user.
 *
 * When to use:
 * - Use in headless integrations to list and manage send payments.
 *
 * When not to use:
 * - Do not use for payment requests; use PaymentRequestsService instead.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for send payment history and actions.
 *
 * Invariants/assumptions:
 * - Requires `payments:read` scope for history endpoints.
 *
 * Data/auth references:
 * - /api/v1/payments/send endpoint.
 *
 * @advanced
 */
export class SendPaymentsService extends BaseService {
    /**
     * Returns send payment history (including pending/escrowed).
     * @scope payments:read
     */
    async listSendPaymentHistory(query = {}) {
        const search = new URLSearchParams();
        if (query.transactionType)
            search.set('transactionType', query.transactionType);
        if (query.status)
            search.set('status', query.status);
        if (query.recipientAccount)
            search.set('recipientAccount', query.recipientAccount);
        if (typeof query.isPendingPayment === 'boolean') {
            search.set('isPendingPayment', String(query.isPendingPayment));
        }
        if (query.startDate)
            search.set('startDate', query.startDate);
        if (query.endDate)
            search.set('endDate', query.endDate);
        if (typeof query.limit === 'number')
            search.set('limit', String(query.limit));
        if (typeof query.offset === 'number')
            search.set('offset', String(query.offset));
        const path = `/payments/send${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Submit a send payment.
     * @scope payments:execute
     * @iee send_payment_submit
     */
    async submitSendPayment(input, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'send_payment_submit',
            payload: {
                transaction_type: input.transactionType,
                amount_wei: input.amountWei,
                network_id: input.networkId,
                contract: input.contract,
                recipient_contact: input.recipientContact,
            },
            receipt: options?.receipt,
        });
        return this.client.post('/payments/send', input, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Cancel a send payment.
     * @scope payments:execute
     * @iee send_payment_cancel
     */
    async cancelSendPayment(paymentId, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'send_payment_cancel',
            payload: { payment_transfer_id: paymentId },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/send/${encodeURIComponent(paymentId)}/cancel`, {}, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Remind recipient of a send payment.
     * @scope payments:execute
     * @iee send_payment_remind
     */
    async remindSendPayment(paymentId, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'send_payment_remind',
            payload: { payment_transfer_id: paymentId },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/send/${encodeURIComponent(paymentId)}/remind`, {}, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Verify a send payment transaction hash.
     * @scope payments:execute
     * @iee send_payment_verify
     */
    async verifySendPayment(paymentId, input, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'send_payment_verify',
            payload: {
                payment_transfer_id: paymentId,
                transaction_hash: input.transactionHash,
                ...(input.network ? { network: input.network } : {}),
            },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/send/${encodeURIComponent(paymentId)}/verify`, input, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Cancel a pending on-chain payment.
     * @scope payments:execute
     * @iee send_payment_cancel_onchain
     */
    async cancelPendingPaymentOnchain(paymentId, input, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'send_payment_cancel_onchain',
            payload: {
                payment_transfer_id: paymentId,
                cancel_tx_hash: input.cancelTxHash,
            },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/send/${encodeURIComponent(paymentId)}/pending-payment/cancel`, input, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
}
/**
 * Payment requests service for `/api/v1/payments/requests/*`.
 *
 * @remarks
 * Purpose:
 * - Retrieve and manage payment requests for the authenticated user.
 *
 * When to use:
 * - Use in headless integrations to list and manage payment requests.
 *
 * When not to use:
 * - Do not use for send payments; use SendPaymentsService instead.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for payment request history and actions.
 *
 * Invariants/assumptions:
 * - Requires `payments:read` scope for history endpoints.
 *
 * Data/auth references:
 * - /api/v1/payments/requests/incoming and /api/v1/payments/requests/transactions endpoints.
 *
 * @advanced
 */
export class PaymentRequestsService extends BaseService {
    /**
     * Returns incoming payment request history (payer/recipient view).
     * @scope payments:read
     */
    async listIncomingPaymentRequestHistory(query = {}) {
        const search = new URLSearchParams();
        if (query.type)
            search.set('type', query.type);
        if (query.status)
            search.set('status', query.status);
        if (query.account)
            search.set('account', query.account);
        if (query.startDate)
            search.set('startDate', query.startDate);
        if (query.endDate)
            search.set('endDate', query.endDate);
        if (typeof query.limit === 'number')
            search.set('limit', String(query.limit));
        if (typeof query.offset === 'number')
            search.set('offset', String(query.offset));
        const path = `/payments/requests/incoming${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Returns outgoing payment request history (requestor view).
     * @scope payments:read
     */
    async listOutgoingPaymentRequestHistory(query = {}) {
        const search = new URLSearchParams();
        if (query.type)
            search.set('type', query.type);
        if (query.status)
            search.set('status', query.status);
        if (query.account)
            search.set('account', query.account);
        if (query.startDate)
            search.set('startDate', query.startDate);
        if (query.endDate)
            search.set('endDate', query.endDate);
        if (typeof query.limit === 'number')
            search.set('limit', String(query.limit));
        if (typeof query.offset === 'number')
            search.set('offset', String(query.offset));
        const path = `/payments/requests/transactions${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Create a payment request.
     * @scope payments:execute
     * @iee payment_request_create
     */
    async createPaymentRequest(input, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'payment_request_create',
            payload: {
                payment_request_type: input.type ?? 'P2P',
                transaction_type: input.transactionType,
                amount_wei: input.amountWei,
                fee_amount_wei: input.feeAmountWei ?? '0',
                network_id: input.networkId ?? '',
                account: input.account,
                payer_email: input.payerEmail,
                note: input.description ?? '',
                expires_at: input.expiresAt ?? '',
            },
            receipt: options?.receipt,
        });
        return this.client.post('/payments/requests', { ...input, type: input.type ?? 'P2P' }, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Cancel a payment request.
     * @scope payments:execute
     * @iee payment_request_cancel
     */
    async cancelPaymentRequest(requestId, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'payment_request_cancel',
            payload: { payment_request_id: requestId },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/requests/${encodeURIComponent(requestId)}/cancel`, {}, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Decline a payment request.
     * @scope payments:execute
     * @iee payment_request_decline
     */
    async declinePaymentRequest(requestId, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'payment_request_decline',
            payload: { payment_request_id: requestId },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/requests/${encodeURIComponent(requestId)}/decline`, {}, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Remind payer of a payment request.
     * @scope payments:execute
     * @iee payment_request_remind
     */
    async remindPaymentRequest(requestId, options) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'payment_request_remind',
            payload: { payment_request_id: requestId },
            receipt: options?.receipt,
        });
        return this.client.post(`/payments/requests/${encodeURIComponent(requestId)}/remind`, {}, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
}
/**
 * Transaction history wrapper around `/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Retrieve transaction history and agent failure telemetry for the authenticated user.
 *
 * When to use:
 * - Use for reading on-chain or ledger transaction history in apps/api.
 *
 * When not to use:
 * - Do not use for transfer-provider deposits/withdrawals; use TransfersService instead.
 *
 * Parameters:
 * - `options.client`: APIClient configured for apps/api base URL. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues apps/api requests for transaction history and agent failure data.
 *
 * Invariants/assumptions:
 * - Requires `payments:read` scope for history and failure endpoints.
 *
 * Data/auth references:
 * - /api/v1/transactions/history and /api/v1/transactions/installations/* endpoints.
 *
 * @advanced
 */
export class TransactionHistoryService extends BaseService {
    /**
     * Returns paginated transaction history.
     * @scope payments:read
     */
    async getHistory(params = {}) {
        const search = new URLSearchParams();
        if (params.account)
            search.set('account', params.account);
        if (params.agentInstallationId)
            search.set('agentInstallationId', params.agentInstallationId);
        if (params.agentServiceId)
            search.set('agentServiceId', params.agentServiceId);
        if (params.networkId !== undefined)
            search.set('networkId', String(params.networkId));
        if (params.eventType)
            search.set('eventType', params.eventType);
        if (params.eventSubtype)
            search.set('eventSubtype', params.eventSubtype);
        if (params.executionMethod)
            search.set('executionMethod', params.executionMethod);
        if (typeof params.excludeUserOperationWrappers === 'boolean') {
            search.set('excludeUserOperationWrappers', String(params.excludeUserOperationWrappers));
        }
        if (params.status)
            search.set('status', params.status);
        if (params.direction)
            search.set('direction', params.direction);
        if (params.contract)
            search.set('contract', params.contract);
        if (params.category)
            search.set('category', params.category);
        if (params.assetType)
            search.set('assetType', params.assetType);
        if (params.view && params.view !== 'grouped')
            search.set('view', params.view);
        if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
            const normalizedLimit = Math.floor(params.limit);
            if (normalizedLimit > 0) {
                search.set('limit', String(Math.min(normalizedLimit, 100)));
            }
        }
        if (params.cursor)
            search.set('cursor', params.cursor);
        if (typeof params.offset === 'number')
            search.set('offset', String(params.offset));
        const path = `/transactions/history${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Returns failures for a specific agent installation.
     * @scope payments:read
     */
    async getInstallationFailures(params) {
        const search = new URLSearchParams();
        if (typeof params.limit === 'number')
            search.set('limit', String(params.limit));
        if (typeof params.offset === 'number')
            search.set('offset', String(params.offset));
        const path = `/transactions/installations/${encodeURIComponent(params.installationId)}/failures${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
    /**
     * Returns the failure count for a specific agent installation.
     *
     * @remarks
     * Response may include a breakdown of pre-submission vs on-chain failures.
     * @scope payments:read
     */
    async getInstallationFailureCount(installationId) {
        const path = `/transactions/installations/${encodeURIComponent(installationId)}/failures/count`;
        return this.client.get(path);
    }
    /**
     * Returns failure counts for multiple installations (batch).
     *
     * @remarks
     * Uses `GET /transactions/installations/failures/counts` with repeated `installationIds` query params.
     * Response may include a breakdown of pre-submission vs on-chain failures.
     *
     * @scope payments:read
     */
    async getInstallationFailureCounts(installationIds) {
        const search = new URLSearchParams();
        for (const id of installationIds) {
            const normalized = String(id ?? '').trim();
            if (normalized.length > 0) {
                search.append('installationIds', normalized);
            }
        }
        const path = `/transactions/installations/failures/counts${search.toString() ? `?${search.toString()}` : ''}`;
        return this.client.get(path);
    }
}
/**
 * Format a transaction history amount for display.
 *
 * @remarks
 * Purpose:
 * - Convert raw amount and decimals into a localized, human-readable string.
 *
 * When to use:
 * - Use when rendering TransactionHistoryItem amounts in UI.
 *
 * When not to use:
 * - Do not use for precise calculations or for transfer-provider activity; use raw values instead.
 *
 * Parameters:
 * - `item`: Transaction fields required for formatting (amountRaw, tokenDecimals, tokenSymbol, direction). Nullable: no.
 * - `locale`: Locale(s) for Intl.NumberFormat. Nullable: yes.
 *
 * Return semantics:
 * - Returns a formatted amount string (prefixed with "-" for outflows).
 *
 * Errors/failure modes:
 * - None; returns empty string when amount is missing.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `tokenDecimals` is numeric when provided.
 *
 * Data/auth references:
 * - Uses TransactionHistoryItem fields provided by apps/api.
 */
export const formatTransactionAmount = (item, locale = 'en-US') => {
    if (!item.amountRaw ||
        item.tokenDecimals === undefined ||
        item.tokenDecimals === null) {
        return item.amountRaw ?? '';
    }
    const divisor = Math.pow(10, item.tokenDecimals);
    const value = Number(item.amountRaw) / divisor;
    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: Math.min(2, item.tokenDecimals),
        maximumFractionDigits: item.tokenDecimals,
    });
    const formatted = formatter.format(Math.abs(value));
    const withSymbol = item.tokenSymbol
        ? `${formatted} ${item.tokenSymbol}`
        : formatted;
    const isOut = item.direction === 'out';
    return isOut ? `-${withSymbol}` : withSymbol;
};
/**
 * Marketplace catalog service for listing available agents.
 *
 * @remarks
 * Purpose:
 * - Retrieve tenant-scoped agent catalog entries for end users.
 *
 * When to use:
 * - Use when you need to list marketplace agents for a tenant.
 *
 * When not to use:
 * - Do not use for global catalog discovery; this surface is tenant-scoped.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests to the marketplace catalog endpoints.
 *
 * Invariants/assumptions:
 * - Catalog is curated per tenant.
 *
 * Data/auth references:
 * - /marketplace/tenant/catalog endpoints.
 *
 * @advanced
 */
export class MarketplaceCatalogService extends BaseService {
    /**
     * Lists approved agents from the marketplace catalog.
     * @scope agents:read
     */
    async listAgents() {
        // NOTE: This SDK surface is intended for end users (tenant-scoped curated marketplace),
        // not the global discovery catalog used by platform owners/developers.
        const raw = await this.client.get('/marketplace/tenant/catalog');
        return (raw ?? []).map(mapMarketplaceAgent);
    }
    /**
     * Lists tenant-enabled agents for the current tenant context (curated set for end users).
     * @scope agents:read
     */
    async listTenantAgents() {
        const raw = await this.client.get('/marketplace/tenant/catalog');
        return (raw ?? []).map(mapMarketplaceAgent);
    }
}
/**
 * Maps OAuth marketplace catalog rows to SDK-friendly types.
 *
 * @remarks
 * - Expects canonical `network` + `operating_token.contract` fields from OAuth.
 * - Normalizes network identifiers to string form.
 *
 * @param dto - Raw marketplace catalog record from OAuth.
 * @returns MarketplaceAgent with canonical network + operating token fields.
 * @errors None (best-effort mapping).
 * @sideEffects None.
 * @invariants `agentServiceId` is always mapped from `agent_service_id`.
 *
 * @see apps/oauth-server/src/oauth/services/marketplace.service.ts
 */
function mapMarketplaceAgent(dto) {
    return {
        id: dto.id,
        agentServiceId: dto.agent_service_id,
        displayName: dto.display_name,
        description: dto.description,
        avatarUrl: dto.avatar_url,
        iconUrl: dto.icon_url ?? null,
        bannerUrl: dto.banner_url ?? null,
        publisherUrl: dto.publisher_url ?? null,
        publisherName: dto.publisher_name ?? null,
        contactEmail: dto.contact_email ?? null,
        supportUrl: dto.support_url ?? null,
        privacyPolicyUrl: dto.privacy_policy_url ?? null,
        termsUrl: dto.terms_url ?? null,
        tags: dto.tags ?? [],
        releaseNotes: dto.release_notes ?? null,
        network: dto.network
            ? {
                networkId: dto.network.network_id !== undefined &&
                    dto.network.network_id !== null
                    ? String(dto.network.network_id)
                    : '',
                name: dto.network.name,
                nativeCurrency: dto.network.native_currency ?? undefined,
                isTestnet: dto.network.is_testnet ?? undefined,
            }
            : null,
        operatingToken: dto.operating_token
            ? {
                tokenPoolId: dto.operating_token.token_pool_id,
                symbol: dto.operating_token.symbol,
                name: dto.operating_token.name,
                contract: dto.operating_token.contract,
                decimals: dto.operating_token.decimals,
                isStable: dto.operating_token.is_stable ?? undefined,
                logoUrl: dto.operating_token.logo_url ?? null,
            }
            : null,
        availableOperatingTokens: Array.isArray(dto.available_operating_tokens)
            ? dto.available_operating_tokens.map((token) => ({
                tokenPoolId: token.token_pool_id,
                symbol: token.symbol,
                name: token.name,
                contract: token.contract,
                decimals: token.decimals,
                isStable: token.is_stable ?? undefined,
                logoUrl: token.logo_url ?? null,
                minimumBudget: token.minimum_budget ?? null,
            }))
            : null,
        category: dto.category,
        pricingModel: dto.pricing_model,
        pricingDetails: dto.pricing_details ?? {},
        feeSummary: dto.fee_summary
            ? {
                platformFeeBps: dto.fee_summary.platform_fee_bps,
                tenantFeeBps: dto.fee_summary.tenant_fee_bps,
                totalFeeBps: dto.fee_summary.total_fee_bps,
                developerRemainderBps: dto.fee_summary.developer_remainder_bps,
            }
            : null,
        minimumBudget: dto.minimum_budget ?? null,
        minimumBudgetByTokenPoolId: dto.minimum_budget_by_token_pool_id ?? null,
        minValidityDays: dto.min_validity_days ?? null,
        defaultValidityDays: dto.default_validity_days ?? null,
        maxValidityDays: dto.max_validity_days ?? null,
        installQuestions: dto.install_questions ?? undefined,
        installQuestionsVersion: dto.install_questions_version ?? null,
        status: dto.status,
        featured: dto.featured,
        featuredOrder: dto.featured_order,
        installCount: dto.install_count,
        createdAt: dto.created_at,
        updatedAt: dto.updated_at,
    };
}
/**
 * Agent actions service for install/uninstall operations.
 *
 * @remarks
 * Purpose:
 * - Manage agent installations, budgets, and lifecycle actions for a tenant.
 *
 * When to use:
 * - Use when you need low-level access to agent installation endpoints.
 *
 * When not to use:
 * - Prefer sdk-react hooks (useAgentActions/useMyAgentInstallations) in React apps.
 *
 * Parameters:
 * - `options.client`: APIClient configured for the OAuth protocol host. Nullable: no.
 *
 * Return semantics:
 * - Constructs a service instance; methods perform network requests.
 *
 * Errors/failure modes:
 * - Methods throw SDKError subclasses surfaced by APIClient.
 *
 * Side effects:
 * - Issues OAuth server requests that may trigger on-chain workflows.
 *
 * Invariants/assumptions:
 * - Requires `agents:read` for reads and `agents:manage` for mutations.
 *
 * Data/auth references:
 * - /agents, /agents/install/*, and related OAuth agent endpoints.
 *
 * @advanced
 */
export class AgentActionsService extends BaseService {
    /**
     * Lists user's agent installations.
     * @scope agents:read
     */
    async listInstallations() {
        const raw = await this.client.get('/agents');
        return (raw ?? []).map(mapAgentInstallationDetails);
    }
    /**
     * Gets a specific agent installation.
     * @scope agents:read
     */
    async getInstallation(agentActorId) {
        const raw = await this.client.get(`/agents/${encodeURIComponent(agentActorId)}`);
        return mapAgentInstallationDetails(raw);
    }
    /**
     * Prepares agent installation (returns unsigned transaction).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_install_prepare_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - When `validateInstallInputs` is true, validates installInputs against installQuestions before sending.
     * @scope agents:manage
     */
    async prepareInstallation(request) {
        const selectedTokenPoolId = String(request.selectedTokenPoolId ?? '').trim();
        const tokenBudgetModeRaw = typeof request.tokenBudgetMode === 'string'
            ? request.tokenBudgetMode.trim().toLowerCase()
            : '';
        const tokenBudgetMode = tokenBudgetModeRaw === 'single' || tokenBudgetModeRaw === 'all'
            ? tokenBudgetModeRaw
            : '';
        if (tokenBudgetModeRaw && !tokenBudgetMode) {
            throw new ValidationError("tokenBudgetMode must be either 'single' or 'all'");
        }
        const tokenBudgetsByTokenPoolId = Object.entries(request.tokenBudgetsByTokenPoolId ?? {}).reduce((acc, [rawTokenPoolId, rawBudget]) => {
            const tokenPoolId = String(rawTokenPoolId ?? '').trim();
            const budget = String(rawBudget ?? '').trim();
            if (!tokenPoolId) {
                throw new ValidationError('tokenBudgetsByTokenPoolId keys must be non-empty token pool ids');
            }
            if (!/^\d+$/.test(budget)) {
                throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be a base-unit numeric string`);
            }
            acc[tokenPoolId] = budget;
            return acc;
        }, {});
        if (tokenBudgetMode === 'single' &&
            Object.keys(tokenBudgetsByTokenPoolId).length > 0 &&
            !selectedTokenPoolId) {
            throw new ValidationError('selectedTokenPoolId is required when tokenBudgetMode is single and token budgets are provided');
        }
        let installInputs = request.installInputs;
        if (request.validateInstallInputs) {
            if (!Array.isArray(request.installQuestions)) {
                throw new ValidationError('installQuestions is required when validateInstallInputs is true');
            }
            const validation = normalizeInstallInputs(request.installQuestions, request.installInputs ?? {}, { mode: 'install' });
            if (Object.keys(validation.errors).length > 0) {
                throw new ValidationError(`installInputs validation failed: ${JSON.stringify(validation.errors)}`);
            }
            installInputs = validation.normalized;
        }
        const metadata = {
            ...(request.metadata ?? {}),
            ...(installInputs ? { install_inputs: installInputs } : {}),
            ...(request.installQuestionsVersion !== undefined
                ? { install_questions_version: request.installQuestionsVersion }
                : {}),
            ...(Object.keys(tokenBudgetsByTokenPoolId).length > 0
                ? {
                    token_budgets_by_token_pool_id: tokenBudgetsByTokenPoolId,
                    ...(tokenBudgetMode ? { token_budget_mode: tokenBudgetMode } : {}),
                }
                : {}),
        };
        const payload = {
            agent_service_id: request.agentServiceId,
            ...(selectedTokenPoolId
                ? { selected_token_pool_id: selectedTokenPoolId }
                : {}),
            install_label: request.installLabel,
            budget: request.budget,
            ...(Array.isArray(request.permissions)
                ? { permissions: request.permissions }
                : {}),
            ...(request.validityDays !== undefined
                ? { validity_days: request.validityDays }
                : {}),
            metadata,
        };
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_install_prepare',
            payload: {
                agent_service_id: request.agentServiceId,
                ...(selectedTokenPoolId
                    ? { selected_token_pool_id: selectedTokenPoolId }
                    : {}),
                budget: request.budget,
                ...(request.validityDays !== undefined
                    ? { validity_days: request.validityDays }
                    : {}),
                ...(request.installLabel
                    ? { install_label: request.installLabel }
                    : {}),
            },
            receipt: request.receipt,
        });
        const raw = await this.client.post('/agents/install/prepare', payload, {
            headers: { 'X-XKOVA-IEE-Receipt': approval.receipt },
        });
        return {
            installationId: raw.installation_id,
            agentPass: raw.agent_pass,
            account: raw.account,
            unsignedTransaction: raw.unsigned_transaction,
            thirdwebClientId: raw.thirdweb_client_id,
            expiresAt: raw.expires_at,
        };
    }
    /**
     * Confirms agent installation after client-side signing.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_install_confirm_v1`.
     * - Uses an extended timeout to accommodate on-chain verification and provisioning work.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async confirmInstallation(request) {
        const explicitReceipt = typeof request.receipt === 'string' ? request.receipt.trim() : '';
        let agentServiceId = typeof request.agentServiceId === 'string'
            ? request.agentServiceId.trim()
            : '';
        let budget = typeof request.budget === 'string'
            ? request.budget.trim()
            : '';
        const providedTxHash = String(request.transactionHash ?? '').trim();
        if (!providedTxHash) {
            throw new ValidationError('transactionHash is required to confirm installation');
        }
        const payload = {
            installation_id: request.installationId,
            transaction_hash: providedTxHash,
        };
        let approval;
        if (explicitReceipt) {
            approval = {
                status: 'approved',
                receipt: explicitReceipt,
                sdkActionType: 'agent_install_confirm',
                serverActionType: 'agent_install_confirm_v1',
            };
        }
        else {
            if (!agentServiceId || !budget) {
                const resolved = await this.resolveInstallationById(request.installationId);
                if (resolved) {
                    let resolvedBudgetTotal = '';
                    if (resolved.tokenBudgetsByTokenPoolId &&
                        typeof resolved.tokenBudgetsByTokenPoolId === 'object') {
                        let total = 0n;
                        let hasBudget = false;
                        for (const rawBudget of Object.values(resolved.tokenBudgetsByTokenPoolId)) {
                            const budgetValue = String(rawBudget ?? '').trim();
                            if (!/^\d+$/.test(budgetValue))
                                continue;
                            total += BigInt(budgetValue);
                            hasBudget = true;
                        }
                        if (hasBudget) {
                            resolvedBudgetTotal = total.toString();
                        }
                    }
                    agentServiceId = agentServiceId || resolved.agentServiceId;
                    budget = budget || resolvedBudgetTotal;
                }
            }
            if (!agentServiceId || !budget) {
                throw new ValidationError('agentServiceId and budget are required to confirm installation without an explicit receipt');
            }
            approval = await this.ensureIeeReceipt({
                actionType: 'agent_install_confirm',
                payload: {
                    agent_service_id: agentServiceId,
                    budget,
                    ...(request.installationId
                        ? { installation_id: request.installationId }
                        : {}),
                    transaction_hash: providedTxHash,
                },
                receipt: request.receipt,
            });
        }
        const approvalInstallationId = String(approval.installationId ?? '').trim();
        if (approvalInstallationId &&
            approvalInstallationId !== request.installationId) {
            throw new ValidationError('installationId does not match SafeApprove approval');
        }
        const approvalTxHash = String(approval.transactionHash ?? '').trim();
        if (approvalTxHash &&
            approvalTxHash.toLowerCase() !== providedTxHash.toLowerCase()) {
            throw new ValidationError('transactionHash does not match SafeApprove approval');
        }
        const raw = await this.client.post('/agents/install/confirm', payload, {
            headers: { 'X-XKOVA-IEE-Receipt': approval.receipt },
            requestPolicy: {
                timeoutMs: 60000,
                attemptTimeoutMs: 30000,
            },
        });
        return {
            installationId: raw.installation_id,
            agentActorId: raw.agent_actor_id,
            agentPass: raw.agent_pass,
            status: raw.status,
        };
    }
    /**
     * Revokes/uninstalls an agent.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_uninstall_initiate_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async uninstallAgent(agentActorId, receipt) {
        const actorId = String(agentActorId ?? '').trim();
        if (!actorId) {
            throw new ValidationError('agentActorId is required');
        }
        const installation = await this.getInstallation(actorId);
        const installationId = String(installation?.installationId ?? '').trim();
        if (!installationId) {
            throw new ValidationError('installationId is required to uninstall an agent');
        }
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_uninstall_initiate',
            payload: { installation_id: installationId },
            receipt,
        });
        const raw = await this.client.delete(`/agents/${encodeURIComponent(actorId)}`, {
            headers: { 'X-XKOVA-IEE-Receipt': approval.receipt },
        });
        const responseInstallationId = raw.installation_id;
        if (!responseInstallationId) {
            throw new BadResponseError('Uninstall response missing installation_id');
        }
        if (raw.status === 'pending_signature') {
            if (!raw.unsigned_transaction || !raw.thirdweb_client_id) {
                throw new BadResponseError('Uninstall response missing pending_signature fields');
            }
            return {
                status: 'pending_signature',
                installationId: responseInstallationId,
                unsignedTransaction: raw.unsigned_transaction,
                thirdwebClientId: raw.thirdweb_client_id,
            };
        }
        return { status: 'revoked', installationId: responseInstallationId };
    }
    /**
     * Confirms uninstall/revocation after the user signs the on-chain revoke transaction.
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_uninstall_confirm_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async confirmRevocation(installationId, transactionHash, receipt) {
        const normalizedTxHash = String(transactionHash ?? '').trim();
        if (!normalizedTxHash) {
            throw new ValidationError('transactionHash is required to confirm revocation');
        }
        const payload = { transaction_hash: normalizedTxHash };
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_uninstall_confirm',
            payload: {
                installation_id: installationId,
                transaction_hash: normalizedTxHash,
            },
            receipt,
        });
        const approvalTxHash = String(approval.transactionHash ?? '').trim();
        if (approvalTxHash &&
            approvalTxHash.toLowerCase() !== normalizedTxHash.toLowerCase()) {
            throw new ValidationError('transactionHash does not match SafeApprove approval');
        }
        return this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/confirm-revocation`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Pauses an installation (user-initiated or admin override).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_pause_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async pauseInstallation(installationId, reason, options) {
        const payload = reason ? { reason } : undefined;
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_installation_pause',
            payload: {
                installation_id: installationId,
                ...(reason ? { reason } : {}),
            },
            receipt: options?.receipt,
        });
        const raw = await this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/pause`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
        return { status: raw.status, pauseCode: raw.pause_code };
    }
    /**
     * Gets installation status for polling the provisioning flow.
     *
     * @remarks
     * - Calls the OAuth endpoint `GET /agents/installations/:installationId/status`.
     * - OAuth responds with snake_case keys; this method maps to camelCase for SDK consumers.
     *
     * @param installationId - Installation UUID returned by confirm-installation.
     * @returns Installation status snapshot with canonical fields.
     * @errors Throws if the OAuth request fails or the response is malformed.
     * @sideEffects Performs a network request to the OAuth server.
     * @invariants `installationId` must reference an installation owned by the caller.
     *
     * @scope agents:read
     */
    async getInstallationStatus(installationId) {
        const raw = await this.client.get(`/agents/installations/${encodeURIComponent(installationId)}/status`);
        return {
            status: raw.status,
            message: raw.message,
            canRetry: raw.can_retry,
            installationId: raw.installation_id,
            createdAt: raw.created_at,
        };
    }
    /**
     * Retry provisioning webhook delivery for an installation.
     *
     * @remarks
     * - Calls `POST /agents/installations/:installationId/retry-webhook`.
     * - Intended for pending_webhook installs when provisioning delivery failed.
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_retry_webhook_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async retryProvisioningWebhook(installationId, receipt) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_installation_retry_webhook',
            payload: { installation_id: installationId },
            receipt,
        });
        return this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/retry-webhook`, undefined, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    /**
     * Update install configuration inputs and optional token budget metadata for an installation.
     *
     * @remarks
     * - Calls `PATCH /agents/installations/:installationId/config`.
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_config_update_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - When `validateInstallInputs` is true, validates installInputs against installQuestions before sending.
     * @scope agents:manage
     */
    async updateInstallationConfig(installationId, installInputs, options) {
        const id = String(installationId ?? '').trim();
        if (!id) {
            throw new ValidationError('installationId is required to update config');
        }
        if (!installInputs ||
            typeof installInputs !== 'object' ||
            Array.isArray(installInputs)) {
            throw new ValidationError('installInputs must be an object');
        }
        let resolvedInputs = installInputs;
        if (options?.validateInstallInputs) {
            if (!Array.isArray(options.installQuestions)) {
                throw new ValidationError('installQuestions is required when validateInstallInputs is true');
            }
            const validation = normalizeInstallInputs(options.installQuestions, installInputs ?? {}, {
                mode: 'update',
                existingInputs: options.existingInputs ?? {},
            });
            if (Object.keys(validation.errors).length > 0) {
                throw new ValidationError(`installInputs validation failed: ${JSON.stringify(validation.errors)}`);
            }
            resolvedInputs = validation.normalized;
        }
        const tokenBudgetsByTokenPoolIdRaw = options?.tokenBudgetsByTokenPoolId !== undefined &&
            options?.tokenBudgetsByTokenPoolId !== null
            ? options.tokenBudgetsByTokenPoolId
            : null;
        let tokenBudgetsByTokenPoolId = null;
        if (tokenBudgetsByTokenPoolIdRaw !== null) {
            if (typeof tokenBudgetsByTokenPoolIdRaw !== 'object' ||
                Array.isArray(tokenBudgetsByTokenPoolIdRaw)) {
                throw new ValidationError('tokenBudgetsByTokenPoolId must be an object when provided');
            }
            tokenBudgetsByTokenPoolId = Object.entries(tokenBudgetsByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawBudget]) => {
                const tokenPoolId = String(rawTokenPoolId ?? '').trim();
                const budget = String(rawBudget ?? '').trim();
                if (!tokenPoolId) {
                    throw new ValidationError('tokenBudgetsByTokenPoolId keys must be non-empty token pool ids');
                }
                if (!/^\d+$/.test(budget)) {
                    throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be a base-unit numeric string`);
                }
                if (BigInt(budget) <= 0n) {
                    throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be greater than 0`);
                }
                acc[tokenPoolId] = budget;
                return acc;
            }, {});
        }
        const tokenBudgetModeRaw = typeof options?.tokenBudgetMode === 'string'
            ? options.tokenBudgetMode.trim().toLowerCase()
            : '';
        if (tokenBudgetModeRaw &&
            tokenBudgetModeRaw !== 'single' &&
            tokenBudgetModeRaw !== 'all') {
            throw new ValidationError("tokenBudgetMode must be either 'single' or 'all'");
        }
        const tokenBudgetMode = tokenBudgetModeRaw === 'single' || tokenBudgetModeRaw === 'all'
            ? tokenBudgetModeRaw
            : null;
        const installInputsJson = this.stableStringify(resolvedInputs);
        const tokenBudgetsJson = this.stableStringify(tokenBudgetsByTokenPoolId ?? {});
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_installation_config_update',
            payload: {
                installation_id: id,
                install_inputs_json: installInputsJson,
                token_budgets_json: tokenBudgetsJson,
            },
            receipt: options?.receipt,
        });
        const payload = {
            install_inputs: resolvedInputs,
            ...(options?.installQuestionsVersion !== undefined
                ? { install_questions_version: options.installQuestionsVersion }
                : {}),
            ...(tokenBudgetsByTokenPoolIdRaw !== null
                ? { token_budgets_by_token_pool_id: tokenBudgetsByTokenPoolId ?? {} }
                : {}),
            ...(tokenBudgetMode ? { token_budget_mode: tokenBudgetMode } : {}),
        };
        const raw = await this.client.patch(`/agents/installations/${encodeURIComponent(id)}/config`, payload, {
            headers: { 'X-XKOVA-IEE-Receipt': approval.receipt },
        });
        return {
            installationId: raw.installation_id,
            installInputs: raw.install_inputs,
            installQuestionsVersion: raw.install_questions_version ?? null,
            updatedAt: raw.updated_at,
        };
    }
    /**
     * Increase budget for an agent installation (adds base-units to the policy ceiling).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_increase_offchain_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async increaseBudget(installationId, additionalBudget, receipt) {
        const payload = { additional_budget: additionalBudget };
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_budget_increase_offchain',
            payload: {
                installation_id: installationId,
                additional_budget: additionalBudget,
            },
            receipt,
        });
        const raw = await this.client.patch(`/agents/installations/${encodeURIComponent(installationId)}/budget`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
        return { updated: raw.updated, newBudget: raw.new_budget };
    }
    /**
     * Prepare an on-chain agentPass permission update for a budget increase (Option A).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_increase_prepare_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async prepareIncreaseBudget(installationId, additionalBudget, receipt) {
        const payload = { additional_budget: additionalBudget };
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_budget_increase_prepare',
            payload: {
                installation_id: installationId,
                additional_budget: additionalBudget,
            },
            receipt,
        });
        const raw = await this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/budget/prepare`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
        return {
            preparationToken: raw.preparation_token,
            installationId: raw.installation_id,
            agentPass: raw.agent_pass,
            account: raw.account,
            unsignedTransaction: raw.unsigned_transaction,
            thirdwebClientId: raw.thirdweb_client_id,
            expiresAt: raw.expires_at,
            newBudget: raw.new_budget,
        };
    }
    /**
     * Confirm an on-chain agentPass permission update for a budget increase (Option A).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_increase_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - `additionalBudget` is required when the SDK must obtain a receipt.
     * - When a receipt is provided explicitly, it must already be bound to the budget delta + transaction hash.
     * @scope agents:manage
     */
    async confirmIncreaseBudget(installationId, preparationToken, transactionHash, receiptOrOptions) {
        const receipt = typeof receiptOrOptions === 'string'
            ? receiptOrOptions
            : receiptOrOptions?.receipt;
        const additionalBudget = typeof receiptOrOptions === 'string'
            ? null
            : (receiptOrOptions?.additionalBudget ?? null);
        const tokenBudgetsByTokenPoolIdRaw = typeof receiptOrOptions === 'string'
            ? null
            : receiptOrOptions?.tokenBudgetsByTokenPoolId !== undefined &&
                receiptOrOptions?.tokenBudgetsByTokenPoolId !== null
                ? receiptOrOptions.tokenBudgetsByTokenPoolId
                : null;
        let tokenBudgetsByTokenPoolId = null;
        if (tokenBudgetsByTokenPoolIdRaw !== null) {
            if (typeof tokenBudgetsByTokenPoolIdRaw !== 'object' ||
                Array.isArray(tokenBudgetsByTokenPoolIdRaw)) {
                throw new ValidationError('tokenBudgetsByTokenPoolId must be an object when provided');
            }
            tokenBudgetsByTokenPoolId = Object.entries(tokenBudgetsByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawBudget]) => {
                const tokenPoolId = String(rawTokenPoolId ?? '').trim();
                const budget = String(rawBudget ?? '').trim();
                if (!tokenPoolId) {
                    throw new ValidationError('tokenBudgetsByTokenPoolId keys must be non-empty token pool ids');
                }
                if (!/^\d+$/.test(budget)) {
                    throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be a base-unit numeric string`);
                }
                if (BigInt(budget) <= 0n) {
                    throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be greater than 0`);
                }
                acc[tokenPoolId] = budget;
                return acc;
            }, {});
        }
        const tokenBudgetModeRaw = typeof receiptOrOptions === 'string'
            ? ''
            : typeof receiptOrOptions?.tokenBudgetMode === 'string'
                ? receiptOrOptions.tokenBudgetMode.trim().toLowerCase()
                : '';
        if (tokenBudgetModeRaw &&
            tokenBudgetModeRaw !== 'single' &&
            tokenBudgetModeRaw !== 'all') {
            throw new ValidationError("tokenBudgetMode must be either 'single' or 'all'");
        }
        const tokenBudgetMode = tokenBudgetModeRaw === 'single' || tokenBudgetModeRaw === 'all'
            ? tokenBudgetModeRaw
            : null;
        const normalizedAdditionalBudget = typeof additionalBudget === 'string' ? additionalBudget.trim() : '';
        const normalizedReceipt = typeof receipt === 'string' ? receipt.trim() : '';
        if (!normalizedReceipt && !normalizedAdditionalBudget) {
            throw new ValidationError('additionalBudget is required to confirm a budget increase without a receipt');
        }
        const normalizedTxHash = String(transactionHash ?? '').trim();
        if (!normalizedTxHash) {
            throw new ValidationError('transactionHash is required to confirm a budget increase');
        }
        const payload = {
            preparation_token: preparationToken,
            transaction_hash: normalizedTxHash,
            ...(tokenBudgetsByTokenPoolIdRaw !== null
                ? { token_budgets_by_token_pool_id: tokenBudgetsByTokenPoolId ?? {} }
                : {}),
            ...(tokenBudgetMode ? { token_budget_mode: tokenBudgetMode } : {}),
        };
        let approval = null;
        let approvalReceipt = normalizedReceipt;
        if (normalizedReceipt) {
            if (normalizedAdditionalBudget) {
                approval = await this.ensureIeeReceipt({
                    actionType: 'agent_budget_increase',
                    payload: {
                        installation_id: installationId,
                        additional_budget: normalizedAdditionalBudget,
                        transaction_hash: normalizedTxHash,
                    },
                    receipt: normalizedReceipt,
                });
                approvalReceipt = approval.receipt;
            }
        }
        else {
            approval = await this.ensureIeeReceipt({
                actionType: 'agent_budget_increase',
                payload: {
                    installation_id: installationId,
                    additional_budget: normalizedAdditionalBudget,
                    transaction_hash: normalizedTxHash,
                },
            });
            approvalReceipt = approval.receipt;
        }
        if (approval) {
            const approvalToken = String(approval.preparationToken ?? '').trim();
            if (approvalToken && approvalToken !== preparationToken) {
                throw new ValidationError('preparationToken does not match SafeApprove approval');
            }
            const approvalTxHash = String(approval.transactionHash ?? '').trim();
            if (approvalTxHash &&
                approvalTxHash.toLowerCase() !== normalizedTxHash.toLowerCase()) {
                throw new ValidationError('transactionHash does not match SafeApprove approval');
            }
        }
        const raw = await this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/budget/confirm`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approvalReceipt } });
        return { updated: raw.updated, newBudget: raw.new_budget };
    }
    /**
     * Prepare an on-chain agentPass permission update for a budget decrease (reuse existing key).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_decrease_prepare_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async prepareDecreaseBudget(installationId, decreaseAmount, receipt) {
        const payload = { decrease_amount: decreaseAmount };
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_budget_decrease_prepare',
            payload: {
                installation_id: installationId,
                decrease_amount: decreaseAmount,
            },
            receipt,
        });
        const raw = await this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/budget/decrease/prepare`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
        return {
            preparationToken: raw.preparation_token,
            installationId: raw.installation_id,
            agentPass: raw.agent_pass,
            account: raw.account,
            unsignedTransaction: raw.unsigned_transaction,
            thirdwebClientId: raw.thirdweb_client_id,
            expiresAt: raw.expires_at,
            newBudget: raw.new_budget,
        };
    }
    /**
     * Confirm an on-chain agentPass permission update for a budget decrease (reuse existing key).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_budget_decrease_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * - `decreaseAmount` is required when the SDK must obtain a receipt.
     * - When a receipt is provided explicitly, it must already be bound to the budget delta + transaction hash.
     * @scope agents:manage
     */
    async confirmDecreaseBudget(installationId, preparationToken, transactionHash, receiptOrOptions) {
        const receipt = typeof receiptOrOptions === 'string'
            ? receiptOrOptions
            : receiptOrOptions?.receipt;
        const decreaseAmount = typeof receiptOrOptions === 'string'
            ? null
            : (receiptOrOptions?.decreaseAmount ?? null);
        const tokenBudgetsByTokenPoolIdRaw = typeof receiptOrOptions === 'string'
            ? null
            : receiptOrOptions?.tokenBudgetsByTokenPoolId !== undefined &&
                receiptOrOptions?.tokenBudgetsByTokenPoolId !== null
                ? receiptOrOptions.tokenBudgetsByTokenPoolId
                : null;
        let tokenBudgetsByTokenPoolId = null;
        if (tokenBudgetsByTokenPoolIdRaw !== null) {
            if (typeof tokenBudgetsByTokenPoolIdRaw !== 'object' ||
                Array.isArray(tokenBudgetsByTokenPoolIdRaw)) {
                throw new ValidationError('tokenBudgetsByTokenPoolId must be an object when provided');
            }
            tokenBudgetsByTokenPoolId = Object.entries(tokenBudgetsByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawBudget]) => {
                const tokenPoolId = String(rawTokenPoolId ?? '').trim();
                const budget = String(rawBudget ?? '').trim();
                if (!tokenPoolId) {
                    throw new ValidationError('tokenBudgetsByTokenPoolId keys must be non-empty token pool ids');
                }
                if (!/^\d+$/.test(budget)) {
                    throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be a base-unit numeric string`);
                }
                if (BigInt(budget) <= 0n) {
                    throw new ValidationError(`tokenBudgetsByTokenPoolId.${tokenPoolId} must be greater than 0`);
                }
                acc[tokenPoolId] = budget;
                return acc;
            }, {});
        }
        const tokenBudgetModeRaw = typeof receiptOrOptions === 'string'
            ? ''
            : typeof receiptOrOptions?.tokenBudgetMode === 'string'
                ? receiptOrOptions.tokenBudgetMode.trim().toLowerCase()
                : '';
        if (tokenBudgetModeRaw &&
            tokenBudgetModeRaw !== 'single' &&
            tokenBudgetModeRaw !== 'all') {
            throw new ValidationError("tokenBudgetMode must be either 'single' or 'all'");
        }
        const tokenBudgetMode = tokenBudgetModeRaw === 'single' || tokenBudgetModeRaw === 'all'
            ? tokenBudgetModeRaw
            : null;
        const normalizedDecreaseAmount = typeof decreaseAmount === 'string' ? decreaseAmount.trim() : '';
        const normalizedReceipt = typeof receipt === 'string' ? receipt.trim() : '';
        if (!normalizedReceipt && !normalizedDecreaseAmount) {
            throw new ValidationError('decreaseAmount is required to confirm a budget decrease without a receipt');
        }
        const normalizedTxHash = String(transactionHash ?? '').trim();
        if (!normalizedTxHash) {
            throw new ValidationError('transactionHash is required to confirm a budget decrease');
        }
        const payload = {
            preparation_token: preparationToken,
            transaction_hash: normalizedTxHash,
            ...(tokenBudgetsByTokenPoolIdRaw !== null
                ? { token_budgets_by_token_pool_id: tokenBudgetsByTokenPoolId ?? {} }
                : {}),
            ...(tokenBudgetMode ? { token_budget_mode: tokenBudgetMode } : {}),
        };
        let approval = null;
        let approvalReceipt = normalizedReceipt;
        if (normalizedReceipt) {
            if (normalizedDecreaseAmount) {
                approval = await this.ensureIeeReceipt({
                    actionType: 'agent_budget_decrease',
                    payload: {
                        installation_id: installationId,
                        decrease_amount: normalizedDecreaseAmount,
                        transaction_hash: normalizedTxHash,
                    },
                    receipt: normalizedReceipt,
                });
                approvalReceipt = approval.receipt;
            }
        }
        else {
            approval = await this.ensureIeeReceipt({
                actionType: 'agent_budget_decrease',
                payload: {
                    installation_id: installationId,
                    decrease_amount: normalizedDecreaseAmount,
                    transaction_hash: normalizedTxHash,
                },
            });
            approvalReceipt = approval.receipt;
        }
        if (approval) {
            const approvalToken = String(approval.preparationToken ?? '').trim();
            if (approvalToken && approvalToken !== preparationToken) {
                throw new ValidationError('preparationToken does not match SafeApprove approval');
            }
            const approvalTxHash = String(approval.transactionHash ?? '').trim();
            if (approvalTxHash &&
                approvalTxHash.toLowerCase() !== normalizedTxHash.toLowerCase()) {
                throw new ValidationError('transactionHash does not match SafeApprove approval');
            }
        }
        const raw = await this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/budget/decrease/confirm`, payload, { headers: { 'X-XKOVA-IEE-Receipt': approvalReceipt } });
        return { updated: raw.updated, newBudget: raw.new_budget };
    }
    /**
     * Resume a paused installation (manual resume).
     *
     * @remarks
     * - Requires an IEE (SafeApprove) receipt header for `agent_installation_resume_v1`.
     * - When an IEE (SafeApprove) orchestrator is available, it will obtain the receipt automatically.
     * @scope agents:manage
     */
    async resumeInstallation(installationId, receipt) {
        const approval = await this.ensureIeeReceipt({
            actionType: 'agent_installation_resume',
            payload: { installation_id: installationId },
            receipt,
        });
        return this.client.post(`/agents/installations/${encodeURIComponent(installationId)}/resume`, undefined, { headers: { 'X-XKOVA-IEE-Receipt': approval.receipt } });
    }
    stableStringify(value) {
        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
        }
        if (value && typeof value === 'object') {
            const entries = Object.entries(value)
                .filter(([, v]) => v !== undefined)
                .sort(([a], [b]) => a.localeCompare(b));
            const inner = entries
                .map(([key, val]) => `${JSON.stringify(key)}:${this.stableStringify(val)}`)
                .join(',');
            return `{${inner}}`;
        }
        return JSON.stringify(value ?? null);
    }
    async resolveInstallationById(installationId) {
        const id = String(installationId ?? '').trim();
        if (!id) {
            return null;
        }
        const installations = await this.listInstallations();
        return (installations.find((installation) => installation.installationId === id) ?? null);
    }
}
/** Maps API response to SDK type. */
function mapAgentInstallationDetails(dto) {
    const availableOperatingTokens = Array.isArray(dto.available_operating_tokens)
        ? dto.available_operating_tokens
            .map((token) => {
            const tokenPoolId = typeof token?.token_pool_id === 'string'
                ? token.token_pool_id.trim()
                : '';
            if (!tokenPoolId)
                return null;
            const decimalsRaw = typeof token?.decimals === 'number'
                ? token.decimals
                : NaN;
            const minimumBudgetRaw = typeof token?.minimum_budget === 'string'
                ? token.minimum_budget.trim()
                : '';
            return {
                tokenPoolId,
                symbol: typeof token?.symbol === 'string' ? token.symbol : null,
                name: typeof token?.name === 'string' ? token.name : null,
                contract: typeof token?.contract === 'string' ? token.contract : null,
                decimals: Number.isFinite(decimalsRaw) && Number.isInteger(decimalsRaw)
                    ? Number(decimalsRaw)
                    : null,
                isStable: typeof token?.is_stable === 'boolean' ? token.is_stable : null,
                networkPoolId: typeof token?.network_pool_id === 'string'
                    ? token.network_pool_id
                    : null,
                logoUrl: typeof token?.logo_url === 'string' ? token.logo_url : null,
                minimumBudget: minimumBudgetRaw && /^\d+$/.test(minimumBudgetRaw)
                    ? minimumBudgetRaw
                    : null,
            };
        })
            .filter((token) => Boolean(token?.tokenPoolId))
        : null;
    const tokenBudgetsByTokenPoolIdRaw = dto.token_budgets_by_token_pool_id &&
        typeof dto.token_budgets_by_token_pool_id === 'object' &&
        !Array.isArray(dto.token_budgets_by_token_pool_id)
        ? dto.token_budgets_by_token_pool_id
        : null;
    const tokenSymbolsByTokenPoolIdRaw = dto.token_symbols_by_token_pool_id &&
        typeof dto.token_symbols_by_token_pool_id === 'object' &&
        !Array.isArray(dto.token_symbols_by_token_pool_id)
        ? dto.token_symbols_by_token_pool_id
        : null;
    const tokenSymbolsByTokenPoolId = tokenSymbolsByTokenPoolIdRaw &&
        Object.keys(tokenSymbolsByTokenPoolIdRaw).length > 0
        ? Object.entries(tokenSymbolsByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawSymbol]) => {
            const tokenPoolId = String(rawTokenPoolId ?? '').trim();
            const symbol = String(rawSymbol ?? '').trim();
            if (!tokenPoolId || !symbol) {
                return acc;
            }
            acc[tokenPoolId] = symbol;
            return acc;
        }, {})
        : null;
    const tokenBudgetsByTokenPoolId = tokenBudgetsByTokenPoolIdRaw &&
        Object.keys(tokenBudgetsByTokenPoolIdRaw).length > 0
        ? Object.entries(tokenBudgetsByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawBudget]) => {
            const tokenPoolId = String(rawTokenPoolId ?? '').trim();
            const budgetValue = String(rawBudget ?? '').trim();
            if (!tokenPoolId || !/^\d+$/.test(budgetValue)) {
                return acc;
            }
            acc[tokenPoolId] = budgetValue;
            return acc;
        }, {})
        : null;
    const tokenBudgetUsedByTokenPoolIdRaw = dto.token_budget_used_by_token_pool_id &&
        typeof dto.token_budget_used_by_token_pool_id === 'object' &&
        !Array.isArray(dto.token_budget_used_by_token_pool_id)
        ? dto.token_budget_used_by_token_pool_id
        : null;
    const tokenBudgetUsedByTokenPoolId = tokenBudgetUsedByTokenPoolIdRaw &&
        Object.keys(tokenBudgetUsedByTokenPoolIdRaw).length > 0
        ? Object.entries(tokenBudgetUsedByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawAmount]) => {
            const tokenPoolId = String(rawTokenPoolId ?? '').trim();
            const usedValue = String(rawAmount ?? '').trim();
            if (!tokenPoolId || !/^\d+$/.test(usedValue)) {
                return acc;
            }
            acc[tokenPoolId] = usedValue;
            return acc;
        }, {})
        : null;
    const tokenBudgetModeRaw = typeof dto.token_budget_mode === 'string'
        ? dto.token_budget_mode.trim().toLowerCase()
        : '';
    const tokenBudgetMode = tokenBudgetModeRaw === 'single' || tokenBudgetModeRaw === 'all'
        ? tokenBudgetModeRaw
        : null;
    const transactionCountByTokenPoolIdRaw = dto.transaction_count_by_token_pool_id &&
        typeof dto.transaction_count_by_token_pool_id === 'object' &&
        !Array.isArray(dto.transaction_count_by_token_pool_id)
        ? dto.transaction_count_by_token_pool_id
        : null;
    const transactionCountByTokenPoolId = transactionCountByTokenPoolIdRaw &&
        Object.keys(transactionCountByTokenPoolIdRaw).length > 0
        ? Object.entries(transactionCountByTokenPoolIdRaw).reduce((acc, [rawTokenPoolId, rawCount]) => {
            const tokenPoolId = String(rawTokenPoolId ?? '').trim();
            const count = typeof rawCount === 'number'
                ? rawCount
                : Number(String(rawCount ?? '').trim());
            if (!tokenPoolId || !Number.isFinite(count)) {
                return acc;
            }
            acc[tokenPoolId] = Math.max(0, Math.floor(count));
            return acc;
        }, {})
        : null;
    return {
        installationId: dto.installation_id,
        agentActorId: dto.agent_actor_id,
        agentServiceId: dto.agent_service_id,
        status: dto.status,
        rawStatus: dto.raw_status,
        revocationPending: dto.revocation_pending,
        installLabel: dto.install_label,
        installedAt: dto.installed_at,
        agentPass: dto.agent_pass,
        account: dto.account,
        networkId: dto.network_id,
        transactionCountByTokenPoolId: transactionCountByTokenPoolId &&
            Object.keys(transactionCountByTokenPoolId).length > 0
            ? transactionCountByTokenPoolId
            : null,
        feeSchedule: dto.fee_schedule
            ? {
                schemaVersion: dto.fee_schedule.schema_version,
                tenantFeeBps: dto.fee_schedule.tenant_fee_bps,
                boundAt: dto.fee_schedule.bound_at,
                source: {
                    tenantFeeConfigUpdatedAt: dto.fee_schedule.source?.tenant_fee_config_updated_at ?? null,
                    updatedByUserId: dto.fee_schedule.source?.updated_by_user_id ?? null,
                },
            }
            : null,
        feeSummary: dto.fee_summary
            ? {
                platformFeeBps: dto.fee_summary.platform_fee_bps,
                tenantFeeBps: dto.fee_summary.tenant_fee_bps,
                totalFeeBps: dto.fee_summary.total_fee_bps,
                developerRemainderBps: dto.fee_summary.developer_remainder_bps,
            }
            : null,
        revokeReason: dto.revoke_reason ?? null,
        pauseCode: dto.pause_code ?? null,
        blacklistActive: dto.blacklist_active === true,
        blacklistCode: dto.blacklist_code ?? null,
        blacklistReason: dto.blacklist_reason ?? null,
        operatingToken: dto.operating_token
            ? {
                tokenPoolId: dto.operating_token.token_pool_id,
                symbol: dto.operating_token.symbol,
                name: dto.operating_token.name,
                contract: dto.operating_token.contract ?? null,
                decimals: dto.operating_token.decimals ?? null,
                isStable: dto.operating_token.is_stable ?? null,
                logoUrl: dto.operating_token.logo_url ?? null,
            }
            : null,
        availableOperatingTokens,
        tokenBudgetsByTokenPoolId: tokenBudgetsByTokenPoolId &&
            Object.keys(tokenBudgetsByTokenPoolId).length > 0
            ? tokenBudgetsByTokenPoolId
            : null,
        tokenSymbolsByTokenPoolId: tokenSymbolsByTokenPoolId &&
            Object.keys(tokenSymbolsByTokenPoolId).length > 0
            ? tokenSymbolsByTokenPoolId
            : null,
        tokenBudgetUsedByTokenPoolId: tokenBudgetUsedByTokenPoolId &&
            Object.keys(tokenBudgetUsedByTokenPoolId).length > 0
            ? tokenBudgetUsedByTokenPoolId
            : null,
        tokenBudgetMode,
        installInputs: dto.install_inputs ?? undefined,
        installQuestions: dto.install_questions ?? undefined,
        installQuestionsVersion: dto.install_questions_version ?? null,
        service: {
            name: dto.service.name,
            displayName: dto.service.display_name,
            description: dto.service.description,
            avatarUrl: dto.service.avatar_url,
            iconUrl: dto.service.icon_url ?? null,
            bannerUrl: dto.service.banner_url ?? null,
            marketplaceStatus: dto.service.marketplace_status,
        },
    };
}
/**
 * Construct grouped SDK service instances from API clients.
 *
 * @remarks
 * Purpose:
 * - Create a convenience bundle of apps/api and oauth-server service wrappers.
 *
 * When to use:
 * - Use in headless integrations where you manage APIClient instances directly.
 *
 * When not to use:
 * - Prefer OAuthService or sdk-react hooks in React-first integrations.
 *
 * Parameters:
 * - `options.api`: APIClient configured for apps/api base URL. Nullable: no.
 * - `options.auth`: APIClient configured for the OAuth protocol host. Nullable: no.
 * - `options.iee`: Optional IEE (SafeApprove) orchestrator to auto-collect receipts for write calls. Nullable: yes.
 *
 * Return semantics:
 * - Returns a grouped object with service instances for accounts, contacts, transfers, etc.
 *
 * Errors/failure modes:
 * - None during construction; service methods may throw SDKError subclasses.
 *
 * Side effects:
 * - None; no network requests are made during construction.
 *
 * Invariants/assumptions:
 * - Clients are correctly configured with base URLs and auth hooks.
 *
 * Data/auth references:
 * - apps/api and oauth-server endpoints per the included services.
 *
 * @advanced
 */
export const createServices = (options) => ({
    // apps/api (/api/v1/*)
    contacts: new ContactsService({ client: options.api, iee: options.iee }),
    transfers: new TransfersService({ client: options.api, iee: options.iee }),
    transactions: new TransactionHistoryService({
        client: options.api,
        iee: options.iee,
    }),
    // oauth-server (protocol host)
    account: new AccountService({ client: options.auth, iee: options.iee }),
    tenantConfig: new TenantConfigService({
        client: options.auth,
        iee: options.iee,
    }),
    userProfile: new UserProfileService({
        client: options.auth,
        iee: options.iee,
    }),
    iee: new IeeService({ client: options.auth, iee: options.iee }),
    sessions: new SessionManagementService({
        client: options.auth,
        iee: options.iee,
    }),
    marketplace: new MarketplaceCatalogService({
        client: options.auth,
        iee: options.iee,
    }),
    agentActions: new AgentActionsService({
        client: options.auth,
        iee: options.iee,
    }),
});
