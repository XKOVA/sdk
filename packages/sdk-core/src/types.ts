/**
 * OAuth scope identifier used throughout the SDK.
 *
 * @remarks
 * Purpose:
 * - Represent OAuth scope strings used in authorization and token responses.
 *
 * When to use:
 * - Use when specifying or inspecting OAuth scopes in SDK calls.
 *
 * When not to use:
 * - Do not invent new scopes; use values issued by the OAuth server.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Scope values are space-delimited strings in OAuth responses.
 *
 * Data/auth references:
 * - OAuth `/oauth/authorize` and `/oauth/token` scopes.
 */
export type Scope = string;

/**
 * Default scopes used when no override is provided.
 *
 * @remarks
 * Purpose:
 * - Provide the standard scope set requested by SDK helpers.
 *
 * When to use:
 * - Use when constructing authorize URLs or OAuthService options without custom scope needs.
 *
 * When not to use:
 * - Do not use if your app requires a narrower scope set; pass explicit scopes instead.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Constant array of scope strings.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Contains all scopes required by default SDK flows.
 *
 * Data/auth references:
 * - OAuth `/oauth/authorize` and `/oauth/token` scope parameters.
 */
export const DEFAULT_SCOPES: Scope[] = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'account:read',
  'account:manage',
  'contacts:read',
  'contacts:manage',
  'payments:read',
  'payments:execute',
  'transfers',
  'agents:read',
  'agents:manage',
];

/**
 * Contact record returned by apps/api contacts endpoints.
 *
 * @remarks
 * Purpose:
 * - Represents a single contact in the authenticated user's personal contact list.
 *
 * When to use:
 * - Use when consuming contacts list or CRUD responses from apps/api.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `id` is a UUID string; `email` is non-empty.
 *
 * Field notes:
 * - `handle` and `account` are derived server-side via XNS lookups for registered contacts.
 * - `avatarUrl`, `notes`, and `isFavorite` are legacy-compatible fields that are not backed by
 *   the current contacts table; they are always `undefined` / default values in current API responses.
 *
 * Data/auth references:
 * - apps/api: `GET /api/v1/contacts` and related CRUD endpoints.
 *
 * @property id - Contact UUID (v4).
 * @property email - Contact email address.
 * @property name - Required display name.
 * @property isRegistered - True when the contact is a registered XKOVA user (best-effort).
 * @property handle - Optional XNS handle (derived; may be undefined even when registered).
 * @property account - Optional account identifier for registered contacts (derived; may be undefined).
 * @property avatarUrl - Legacy field (not supported in current schema).
 * @property notes - Legacy field (not supported in current schema).
 * @property isFavorite - Legacy field (not supported in current schema; always false).
 * @property createdAt - ISO 8601 creation timestamp (nullable/optional).
 * @property updatedAt - ISO 8601 update timestamp (nullable/optional).
 *
 * @example
 * {
 *   "id": "d7822485-77cf-4c31-b835-fffc1ca51842",
 *   "email": "john.doe@example.com",
 *   "name": "John Doe",
 *   "isRegistered": false,
 *   "createdAt": "2026-01-03T12:00:00.000Z",
 *   "updatedAt": "2026-01-03T12:00:00.000Z"
 * }
 *
 * @see /api/v1/contacts
 * @see apps/api/src/modules/contacts/contacts.controller.ts
 * @see apps/api/src/modules/contacts/dto/contact.dto.ts
 */
export interface Contact {
  id: string;
  email: string;
  name: string;
  isRegistered?: boolean;
  createdAt?: string;
  updatedAt?: string;
  handle?: string;
  account?: string;
  avatarUrl?: string;
  notes?: string;
  isFavorite?: boolean;
}

/**
 * Input payload for creating a contact via `POST /api/v1/contacts`.
 *
 * @remarks
 * Purpose:
 * - Provide payload fields for creating a contact record.
 *
 * When to use:
 * - Use when creating a new contact via apps/api.
 *
 * When not to use:
 * - Do not use when you cannot provide a valid email and name.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `email` should be a valid email string when sent to the API.
 *
 * Data/auth references:
 * - `/api/v1/contacts` (apps/api).
 *
 * Notes:
 * - Only `email` and `name` are persisted in the current API schema.
 * - Other legacy fields are ignored by the server.
 *
 * @property email - Contact email address.
 * @property name - Required display name.
 *
 * @example
 * { "email": "john.doe@example.com", "name": "John Doe" }
 *
 * @see /api/v1/contacts
 */
export interface CreateContactInput {
  email: string;
  name: string;
}

/**
 * Input payload for updating a contact via `PATCH /api/v1/contacts/:contactId`.
 *
 * @remarks
 * Purpose:
 * - Provide optional fields for contact updates.
 *
 * When to use:
 * - Use when updating an existing contact via apps/api.
 *
 * When not to use:
 * - Do not use when you have no fields to update.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - At least one field should be provided for a meaningful update.
 *
 * Data/auth references:
 * - `/api/v1/contacts/:contactId` (apps/api).
 *
 * Notes:
 * - Only `email` and `name` are persisted in the current API schema.
 *
 * @property email - Optional updated email.
 * @property name - Optional updated display name.
 *
 * @example
 * { "name": "New Name" }
 *
 * @see /api/v1/contacts/:contactId
 */
export interface UpdateContactInput {
  email?: string;
  name?: string;
}

/**
 * Query parameters for listing/searching contacts via `GET /api/v1/contacts`.
 *
 * @remarks
 * Purpose:
 * - Provide filter and pagination parameters for contact list queries.
 *
 * When to use:
 * - Use when listing or searching contacts via apps/api.
 *
 * When not to use:
 * - Do not use when you do not need server-side filtering.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `offset` must be >= 0 when provided.
 *
 * Data/auth references:
 * - `/api/v1/contacts` (apps/api).
 *
 * Notes:
 * - apps/api uses offset pagination (`limit`/`offset`) for this endpoint.
 * - `favoritesOnly` exists for backward compatibility but is ignored by the current API schema.
 *
 * @property query - Optional search term (matches name or email).
 * @property favoritesOnly - Legacy filter (ignored by current API; always treated as false).
 * @property limit - Optional page size (1..100).
 * @property offset - Optional offset (>= 0).
 *
 * @example
 * { "query": "john", "limit": 20, "offset": 0 }
 *
 * @see /api/v1/contacts
 */
export interface ContactsListQuery {
  query?: string;
  favoritesOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * List/search response envelope for `GET /api/v1/contacts`.
 *
 * @remarks
 * Purpose:
 * - Represent the list response for contact queries.
 *
 * When to use:
 * - Use when consuming raw contact list responses from apps/api.
 *
 * When not to use:
 * - Prefer SDK hooks or ContactsService for normalized access.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `contacts` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/contacts` (apps/api).
 *
 * Notes:
 * - apps/api wraps responses in `{ data, request_id, timestamp }`; the SDK API client unwraps `data`.
 *
 * @property contacts - Contact list for this page.
 * @property total - Total matching contacts for the query (server-counted).
 * @property count - Count of returned contacts in `contacts`.
 * @property searchQuery - Echo of query string (nullable/optional).
 * @property favoritesOnly - Echo of favorites filter (always false in current API).
 *
 * @example
 * { "contacts": [], "total": 0, "count": 0 }
 *
 * @see /api/v1/contacts
 */
export interface ContactsListResponse {
  contacts: Contact[];
  total: number;
  count: number;
  searchQuery?: string;
  favoritesOnly?: boolean;
}

/**
 * Delete result returned by `DELETE /api/v1/contacts/:contactId`.
 *
 * @remarks
 * Purpose:
 * - Represent delete outcomes for contact records.
 *
 * When to use:
 * - Use when consuming delete responses from apps/api.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `success` is boolean.
 *
 * Data/auth references:
 * - `/api/v1/contacts/:contactId` (apps/api).
 *
 * Notes:
 * - apps/api wraps responses in `{ data, request_id, timestamp }`; the SDK API client unwraps `data`.
 *
 * @property success - True when deletion succeeded.
 * @property message - Human-friendly result message.
 *
 * @example
 * { "success": true, "message": "Contact deleted successfully" }
 *
 * @see /api/v1/contacts/:contactId
 */
export interface DeleteContactResult {
  success: boolean;
  message: string;
}

/**
 * Bulk contact operation identifier for `POST /api/v1/contacts/bulk`.
 *
 * @remarks
 * Purpose:
 * - Define supported bulk contact operation literals.
 *
 * When to use:
 * - Use when submitting bulk contact operations to apps/api.
 *
 * When not to use:
 * - Do not use outside the `/contacts/bulk` API context.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/contacts/bulk` (apps/api).
 *
 * Notes:
 * - `favorite` / `unfavorite` are legacy operations; current apps/api does not persist favorites.
 *
 * @see /api/v1/contacts/bulk
 */
export type BulkContactsOperation = 'delete' | 'favorite' | 'unfavorite';

/**
 * Input payload for bulk contact operations via `POST /api/v1/contacts/bulk`.
 *
 * @remarks
 * Purpose:
 * - Provide input fields for bulk contact operations.
 *
 * When to use:
 * - Use when requesting bulk deletes or legacy favorite operations.
 *
 * When not to use:
 * - Do not use when you only need a single contact mutation.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `contactIds` should be a non-empty list for meaningful work.
 *
 * Data/auth references:
 * - `/api/v1/contacts/bulk` (apps/api).
 *
 * Notes:
 * - Bulk delete is supported by apps/api.
 * - Favorite operations are accepted but are no-ops in current apps/api schema.
 *
 * @property contactIds - Array of contact UUIDs.
 * @property operation - Operation identifier.
 *
 * @example
 * { "contactIds": ["uuid1", "uuid2"], "operation": "delete" }
 *
 * @see /api/v1/contacts/bulk
 */
export interface BulkContactsOperationInput {
  contactIds: string[];
  operation: BulkContactsOperation;
}

/**
 * Result returned by `POST /api/v1/contacts/bulk`.
 *
 * @remarks
 * Purpose:
 * - Describe bulk contact operation results returned by apps/api.
 *
 * When to use:
 * - Use when consuming bulk contacts responses from apps/api.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `failedIds.length` should equal `failed`.
 *
 * Data/auth references:
 * - `/api/v1/contacts/bulk` (apps/api).
 *
 * Notes:
 * - Counts are computed best-effort by apps/api and may include legacy no-op operations as successes.
 *
 * @property success - Number of contacts successfully processed.
 * @property failed - Number of contacts that failed.
 * @property failedIds - Array of contact IDs that failed.
 * @property operation - Operation performed.
 *
 * @example
 * { "success": 2, "failed": 0, "failedIds": [], "operation": "delete" }
 *
 * @see /api/v1/contacts/bulk
 */
export interface BulkContactsOperationResult {
  success: number;
  failed: number;
  failedIds: string[];
  operation: BulkContactsOperation;
}

/**
 * Canonical account kind for public SDK consumers.
 *
 * @remarks
 * Purpose:
 * - Represent account kind literals returned by OAuth endpoints.
 *
 * When to use:
 * - Use when inspecting account descriptors returned by oauth-server.
 *
 * When not to use:
 * - Do not invent new kinds; values are server-defined.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to `account`.
 *
 * Data/auth references:
 * - `/account` and `/oauth/user` (oauth-server).
 *
 * Notes:
 * - SDK narrows account kind to primary accounts while additional account linking is disabled.
 *
 * @example
 * "account"
 *
 * @see apps/oauth-server/src/oauth/dto/account-state.dto.ts
 */
export type AccountKind = 'account';

/**
 * Canonical account descriptor returned by OAuth endpoints.
 *
 * @remarks
 * Purpose:
 * - Describe the primary account returned by oauth-server.
 *
 * When to use:
 * - Use when reading account identifiers from `/account` or `/oauth/user`.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `account` is a 0x-prefixed hex identifier; EOAs are not exposed.
 *
 * Data/auth references:
 * - `/account` and `/oauth/user` (oauth-server).
 *
 * Notes:
 * - Represents smart-account-backed accounts only; EOAs are excluded from the public contract.
 * - Field names intentionally avoid legacy account terms and legacy identifier keys.
 *
 * @property name - Stable account label (`account`).
 * @property kind - Canonical account kind (`account`).
 * @property account - Account identifier (0x-prefixed, 40-byte hex string).
 * @property providerInstanceId - Optional provider instance UUID (nullable).
 * @property aaProviderMetadata - Optional AA provider metadata blob.
 * @property metadata - Optional custom metadata blob.
 *
 * @example
 * {
 *   "name": "account",
 *   "kind": "account",
 *   "account": "0x1234567890123456789012345678901234567890",
 *   "providerInstanceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "aaProviderMetadata": {},
 *   "metadata": {}
 * }
 *
 * @see /account
 * @see /oauth/user
 * @see apps/oauth-server/src/oauth/dto/account-state.dto.ts
 */
export interface AccountDescriptor {
  name: string;
  kind: AccountKind;
  account: string;
  providerInstanceId?: string | null;
  aaProviderMetadata?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Account state returned from `GET /account`.
 *
 * @remarks
 * Purpose:
 * - Describe the primary account returned by `/account`.
 *
 * When to use:
 * - Use when consuming account state from oauth-server.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `account` is always present.
 *
 * Data/auth references:
 * - `/account` (oauth-server).
 *
 * @property account - Primary account descriptor (required).
 *
 * @example
 * {
 *   "account": { "name": "account", "kind": "account", "account": "0x..." }
 * }
 *
 * @see /account
 * @see apps/oauth-server/src/oauth/dto/account-state.dto.ts
 */
export interface AccountState {
  account: AccountDescriptor;
}

/**
 * Tokens returned by the OAuth server.
 *
 * @remarks
 * Purpose:
 * - Represent access/refresh token material and metadata from oauth-server.
 *
 * When to use:
 * - Use when storing, passing, or inspecting OAuth tokens in SDK services.
 *
 * When not to use:
 * - Do not log or persist tokens insecurely; treat as sensitive credentials.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `accessToken` is present; `tokenType` is always `bearer`.
 * - `expiresAt` is epoch seconds.
 *
 * Data/auth references:
 * - `/oauth/token` and refresh flows (oauth-server).
 *
 * Security notes:
 * - Access and refresh tokens are sensitive; avoid logging.
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch seconds when the access token expires. */
  expiresAt: number;
  scope: Scope[];
  tokenType: 'bearer';
  issuedAt?: number;
  /** OpenID Connect ID token (for logout identification). */
  idToken?: string;
  /** Server-stored app session identifier (web app-session flows). */
  sessionId?: string;
}

/**
 * Session device classification.
 *
 * @remarks
 * Purpose:
 * - Represent the device category inferred by oauth-server.
 *
 * When to use:
 * - Use when rendering session/device lists.
 *
 * When not to use:
 * - Do not assume accuracy; values are best-effort.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to `mobile`, `tablet`, `desktop`, or `unknown`.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - Derived from the session's user-agent string by the OAuth server.
 * - `unknown` is used when device detection cannot confidently classify the device.
 *
 * @see apps/oauth-server/src/oauth/services/session-coordinator.service.ts
 */
export type SessionDeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

/**
 * Device metadata attached to a user session.
 *
 * @remarks
 * Purpose:
 * - Describe the device metadata for a user session.
 *
 * When to use:
 * - Use when rendering session/device details.
 *
 * When not to use:
 * - Do not assume complete or fully accurate values.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `type` is a SessionDeviceType literal.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - Mirrors oauth-server session metadata returned by `/tenant/sessions`.
 *
 * @property type - Classified device type.
 * @property browser - Browser name (best-effort).
 * @property os - Operating system name (best-effort).
 * @property description - Human-friendly device string (e.g. "Chrome on macOS").
 * @see apps/oauth-server/src/oauth/services/session-coordinator.service.ts
 */
export interface SessionDeviceInfo {
  type: SessionDeviceType;
  browser: string;
  os: string;
  description: string;
}

/**
 * Location metadata attached to a user session.
 *
 * @remarks
 * Purpose:
 * - Describe geo-location fields for a user session.
 *
 * When to use:
 * - Use when displaying session locations in UI.
 *
 * When not to use:
 * - Do not rely on availability or accuracy of location values.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Fields may be omitted when location resolution fails.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - Location values are best-effort and may be unavailable depending on IP resolution.
 *
 * @property city - City name (nullable/optional).
 * @property region - Region/state name (nullable/optional).
 * @property country - Country name/code (nullable/optional).
 * @property display - Pre-formatted string for display (e.g. "San Francisco, US").
 * @see apps/oauth-server/src/oauth/services/session-coordinator.service.ts
 */
export interface SessionLocationInfo {
  city?: string;
  region?: string;
  country?: string;
  display: string;
}

/**
 * Activity metadata attached to a user session.
 *
 * @remarks
 * Purpose:
 * - Describe session activity timestamps and flags.
 *
 * When to use:
 * - Use when showing session activity or last-seen data.
 *
 * When not to use:
 * - Do not assume timestamps are monotonic across devices.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Timestamps are ISO 8601 strings.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - Timestamps are ISO 8601 strings.
 *
 * @property createdAt - Session creation timestamp (ISO 8601).
 * @property lastActiveAt - Last activity timestamp (ISO 8601).
 * @property isCurrentSession - True when this entry corresponds to the caller's current session.
 * @see apps/oauth-server/src/oauth/services/session-coordinator.service.ts
 */
export interface SessionActivityInfo {
  createdAt: string;
  lastActiveAt: string;
  isCurrentSession: boolean;
}

/**
 * Security metadata attached to a user session.
 *
 * @remarks
 * Purpose:
 * - Describe security-related session attributes such as IP and client ID.
 *
 * When to use:
 * - Use when rendering session security details in UI.
 *
 * When not to use:
 * - Do not use as a security enforcement input; values are informational.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Fields are best-effort and may be derived from request metadata.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - `clientId` identifies the OAuth client that minted the session.
 *
 * @property ipAddress - Origin IP address for the session (best-effort).
 * @property clientId - OAuth client identifier for the session.
 *
 * @see apps/oauth-server/src/oauth/services/session-coordinator.service.ts
 */
export interface SessionSecurityInfo {
  ipAddress: string;
  clientId: string;
}

/**
 * Canonical user session returned by XKOVA session management endpoints.
 *
 * @remarks
 * Purpose:
 * - Represent a session entry returned by oauth-server session management.
 *
 * When to use:
 * - Use when displaying session lists or device management UI.
 *
 * When not to use:
 * - Do not treat this as an OAuth access token.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `sessionId` is a stable identifier; metadata objects are present.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - This is a session entry from the server-tracked `user_sessions` table, not an OAuth access token.
 * - Returned by bearer-auth `/tenant/sessions` and used by UI components like `<SessionManager />`.
 *
 * @property sessionId - Stable session UUID.
 * @property device - Device metadata.
 * @property location - Location metadata.
 * @property activity - Activity metadata.
 * @property security - Security metadata.
 * @see apps/oauth-server/src/oauth/controllers/tenant-sessions.controller.ts
 * @see apps/oauth-server/src/oauth/services/session-coordinator.service.ts
 */
export interface UserSession {
  sessionId: string;
  device: SessionDeviceInfo;
  location: SessionLocationInfo;
  activity: SessionActivityInfo;
  security: SessionSecurityInfo;
}

/**
 * Result of listing sessions for the current user.
 *
 * @remarks
 * Purpose:
 * - Describe the normalized session list response.
 *
 * When to use:
 * - Use when consuming results from session listing endpoints.
 *
 * When not to use:
 * - Do not construct manually; prefer SessionManagementService results.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `sessions` is always an array.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - Mirrors oauth-server response shape from `/tenant/sessions` after normalization.
 *
 * @property sessions - Session entries ordered by most recent activity.
 * @property total - Total number of currently-valid sessions across all pages.
 * @property currentSessionId - The resolved "current" session ID (nullable).
 * @property limit - Server-applied page size.
 * @property offset - Server-applied pagination offset.
 * @see apps/oauth-server/src/oauth/controllers/tenant-sessions.controller.ts
 */
export interface UserSessionListResult {
  sessions: UserSession[];
  total: number;
  currentSessionId: string | null;
  /**
   * Page size applied by the server for this response.
   *
   * @remarks
   * - Mirrors oauth-server paging behavior (`limit` query param).
   */
  limit: number;
  /**
   * Pagination offset applied by the server for this response.
   *
   * @remarks
   * - Mirrors oauth-server paging behavior (`offset` query param).
   */
  offset: number;
}

/**
 * Result of revoking a specific session.
 *
 * @remarks
 * Purpose:
 * - Describe the response from revoking a specific session.
 *
 * When to use:
 * - Use after calling revoke session endpoints.
 *
 * When not to use:
 * - Do not use for current session revocation; use logout instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `success` is boolean.
 *
 * Data/auth references:
 * - `/tenant/sessions` (oauth-server).
 *
 * Notes:
 * - The server forbids revoking the current session; use logout instead.
 *
 * @see apps/oauth-server/src/oauth/controllers/tenant-sessions.controller.ts
 */
export interface RevokeUserSessionResult {
  success: boolean;
  message: string;
  revokedSessionId: string;
}

/**
 * Result of revoking all sessions other than the current one.
 *
 * @remarks
 * Purpose:
 * - Describe the response from revoking other sessions.
 *
 * When to use:
 * - Use after calling the "revoke other sessions" endpoint.
 *
 * When not to use:
 * - Do not use for revoking the current session.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `revokedCount` is a count of removed sessions.
 *
 * Data/auth references:
 * - `/tenant/sessions/others` (oauth-server).
 *
 * Notes:
 * - This is the "Sign out of other devices" action.
 *
 * @see apps/oauth-server/src/oauth/controllers/tenant-sessions.controller.ts
 */
export interface RevokeOtherSessionsResult {
  success: boolean;
  message: string;
  revokedCount: number;
  currentSessionId: string | null;
}

/**
 * User identity returned from `/oauth/user`.
 *
 * @remarks
 * Purpose:
 * - Describe the authenticated user identity returned by oauth-server.
 *
 * When to use:
 * - Use when consuming `/oauth/user` or bootstrap identity payloads.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `account` is always present and uses canonical naming.
 *
 * Data/auth references:
 * - `/oauth/user` (oauth-server).
 *
 * Notes:
 * - Uses canonical account naming (`account`).
 * - Tenant context is derived from OAuth token metadata.
 *
 * @property id - User UUID (auth.users.id).
 * @property email - User email.
 * @property emailVerified - Email verification flag (OIDC).
 * @property firstName - Given name (nullable).
 * @property lastName - Family name (nullable).
 * @property name - Display name (nullable).
 * @property handle - XNS handle (nullable).
 * @property avatarUrl - Signed avatar URL (nullable, short-lived).
 * @property completeProfile - True when profile is considered complete.
 * @property account - Primary smart account descriptor.
 * @property tenantId - Tenant UUID (nullable).
 * @property tenantSlug - Tenant slug (nullable).
 * @property tenantName - Tenant name (nullable).
 * @property scope - OAuth scope string (nullable).
 * @property createdAt - ISO 8601 creation timestamp (nullable).
 * @property updatedAt - ISO 8601 update timestamp (nullable).
 *
 * @example
 * {
 *   "id": "d7822485-77cf-4c31-b835-fffc1ca51842",
 *   "email": "user@example.com",
 *   "emailVerified": true,
 *   "firstName": "Jane",
 *   "lastName": "Doe",
 *   "name": "Jane Doe",
 *   "handle": "janedoe",
 *   "completeProfile": true,
 *   "account": { "name": "account", "kind": "account", "account": "0x1234..." },
 *   "tenantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "tenantSlug": "acme",
 *   "tenantName": "Acme",
 *   "scope": "openid account:read",
 *   "createdAt": "2026-01-03T12:00:00.000Z",
 *   "updatedAt": "2026-01-03T12:00:00.000Z"
 * }
 *
 * @see /oauth/user
 */
export interface UserInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  completeProfile: boolean;
  account: AccountDescriptor;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  scope: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Branding and visual configuration attached to a tenant.
 *
 * @remarks
 * Purpose:
 * - Describe tenant branding colors and assets returned by bootstrap.
 *
 * When to use:
 * - Use when applying tenant branding in UI components.
 *
 * When not to use:
 * - Do not assume values are present; all fields are optional.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - All fields are optional and may be null in upstream payloads.
 *
 * Data/auth references:
 * - `/oauth/tenant` bootstrap payload (oauth-server).
 */
export interface TenantBranding {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  faviconUrl?: string;
}

/**
 * Tenant network descriptor returned from `/oauth/tenant`.
 *
 * @remarks
 * Purpose:
 * - Describe a tenant-approved network returned by oauth-server.
 *
 * When to use:
 * - Use when rendering network lists or building RPC clients.
 *
 * When not to use:
 * - Do not use untrusted or unapproved network metadata.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networkId` is a string identifier; pending payments contract is optional.
 *
 * Data/auth references:
 * - `/oauth/tenant` (oauth-server).
 *
 * Notes:
 * - Uses canonical naming (`networkId`, `networkFamily`, `accountFormat`).
 * - `pendingPaymentsContract` is the canonical pending payments contract identifier.
 *
 * @property id - Network pool UUID.
 * @property name - Network display name.
 * @property symbol - Network symbol (nullable).
 * @property networkId - Network identifier (string form of the numeric network id).
 * @property networkFamily - Network family (e.g., evm, solana).
 * @property accountFormat - Account identifier format (e.g., evm_hex).
 * @property rpcUrl - Primary RPC URL (nullable).
 * @property rpcs - Optional RPC list (raw network_pool payload).
 * @property explorerUrl - Explorer base URL (nullable).
 * @property isTestnet - True when network is a testnet (nullable).
 * @property nativeCurrency - Native currency name (nullable).
 * @property nativeCurrencySymbol - Native currency symbol (nullable).
 * @property nativeCurrencyDecimals - Native currency decimals (nullable).
 * @property nativeTokenStandard - Native token standard (nullable).
 * @property logoUrl - Network logo URL (nullable).
 * @property pendingPaymentsContract - Pending payments contract identifier (nullable).
 *
 * @example
 * {
 *   "id": "net_123",
 *   "name": "Avalanche Fuji",
 *   "symbol": "AVAX",
 *   "networkId": "43113",
 *   "networkFamily": "evm",
 *   "accountFormat": "evm_hex",
 *   "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
 *   "explorerUrl": "https://testnet.snowtrace.io",
 *   "isTestnet": true,
 *   "nativeCurrencySymbol": "AVAX",
 *   "pendingPaymentsContract": "0x1234..."
 * }
 *
 * @see /oauth/tenant
 */
export interface TenantNetwork {
  id: string;
  name: string;
  symbol?: string;
  networkId: string;
  networkFamily?: string;
  accountFormat?: string;
  rpcUrl?: string;
  rpcs?: any;
  explorerUrl?: string | null;
  isTestnet?: boolean;
  nativeCurrency?: string;
  nativeCurrencySymbol?: string;
  nativeCurrencyDecimals?: number;
  nativeTokenStandard?: string;
  logoUrl?: string | null;
  pendingPaymentsContract?: string | null;
}

/**
 * Token metadata surfaced to clients.
 *
 * @remarks
 * Purpose:
 * - Describe token metadata returned by tenant bootstrap.
 *
 * When to use:
 * - Use when rendering token lists or formatting balances.
 *
 * When not to use:
 * - Do not use for on-chain lookups; prefer chain RPC data when precision matters.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networkId` is a string identifier; `contract` may be null for native assets.
 *
 * Data/auth references:
 * - `/oauth/tenant` (oauth-server).
 *
 * Notes:
 * - Uses canonical `contract` naming for token contracts.
 *
 * @property id - Token pool UUID (nullable).
 * @property contract - Token contract identifier (nullable).
 * @property networkId - Network identifier (string form of the numeric network id).
 * @property symbol - Token symbol.
 * @property decimals - Token decimals.
 * @property tokenType - Token type (native or erc20).
 * @property isStable - Stablecoin indicator (nullable).
 * @property isPrimary - Primary token indicator (nullable).
 * @property isUtility - Utility token indicator (nullable).
 * @property isDefault - Default token indicator (nullable).
 * @property logoUrl - Token logo URL (nullable).
 *
 * @example
 * {
 *   "id": "token_123",
 *   "contract": "0xA0b8...eB48",
 *   "networkId": "1",
 *   "symbol": "USDC",
 *   "decimals": 6,
 *   "tokenType": "erc20"
 * }
 *
 * @see /oauth/tenant
 */
export interface TokenAsset {
  id?: string;
  contract?: string | null;
  networkId: string;
  symbol: string;
  decimals: number;
  tokenType?: 'native' | 'erc20';
  isStable?: boolean;
  isPrimary?: boolean;
  isUtility?: boolean;
  isDefault?: boolean;
  logoUrl?: string | null;
}

/**
 * Transfer provider as returned from `/oauth/tenant`.
 *
 * @remarks
 * Purpose:
 * - Describe transfer provider configuration returned by tenant bootstrap.
 *
 * When to use:
 * - Use when rendering provider choices for deposits/withdrawals.
 *
 * When not to use:
 * - Do not assume all providers support all networks or payment methods.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networkId` is numeric when present.
 *
 * Data/auth references:
 * - `/oauth/tenant` (oauth-server).
 *
 * Notes:
 * - Uses transfer provider terminology for deposit/withdraw flows.
 * - Optional faucet metadata is preserved for testnet flows.
 *
 * @property id - Provider config identifier (nullable).
 * @property providerId - Global provider id (nullable).
 * @property configId - Tenant config id (nullable).
 * @property name - Provider display name (nullable).
 * @property logoUrl - Provider logo URL (nullable).
 * @property integrationMethod - Provider integration method hint (nullable).
 * @property supportedTypes - Supported transfer types (nullable).
 * @property supportedCrypto - Supported crypto symbols (nullable).
 * @property supportedPaymentMethods - Supported payment methods (nullable).
 * @property minAmountUsd - Provider min amount (nullable).
 * @property maxAmountUsd - Provider max amount (nullable).
 * @property baseFeePercent - Provider base fee percent (nullable).
 * @property websiteUrl - Provider website URL (nullable).
 * @property faucetContract - Faucet contract identifier (nullable).
 * @property networkId - Network identifier for faucet contract (nullable).
 * @property supportedNetworks - Supported networks for the provider (nullable).
 * @property metadata - Provider metadata (nullable).
 *
 * @example
 * {
 *   "providerId": "moonpay",
 *   "name": "MoonPay",
 *   "supportedTypes": ["deposit", "withdraw"],
 *   "networkId": 43113
 * }
 *
 * @see /oauth/tenant
 */
export interface TransferProvider {
  id?: string;
  providerId?: string;
  configId?: string;
  name?: string;
  logoUrl?: string | null;
  integrationMethod?: string;
  supportedTypes?: string[];
  supportedCrypto?: string[];
  supportedPaymentMethods?: string[];
  minAmountUsd?: number;
  maxAmountUsd?: number;
  baseFeePercent?: number;
  websiteUrl?: string | null;
  faucetContract?: string;
  networkId?: number;
  supportedNetworks?: Array<{ networkId: number }>;
  metadata?: Record<string, any>;
}

/**
 * Transfer transaction type.
 *
 * @remarks
 * Purpose:
 * - Represent transfer transaction direction literals.
 *
 * When to use:
 * - Use when filtering or labeling transfer transactions.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - Public terminology is `deposit` / `withdraw`.
 * @see /api/v1/transfers/transactions
 */
export type TransferTransactionType = 'deposit' | 'withdraw';

/**
 * Transfer transaction status.
 *
 * @remarks
 * Purpose:
 * - Represent transfer transaction status literals.
 *
 * When to use:
 * - Use when filtering or displaying transfer status.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - These values are returned by `/api/v1/transfers/transactions`.
 * @see /api/v1/transfers/transactions
 */
export type TransferTransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

/**
 * Transfer payment method identifier.
 *
 * @remarks
 * Purpose:
 * - Represent transfer payment method literals.
 *
 * When to use:
 * - Use when specifying or displaying transfer payment methods.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - Canonical value for account-based payments is `account` (not "wallet").
 * @see /api/v1/transfers/transactions
 */
export type TransferPaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'sepa'
  | 'ach'
  | 'wire_transfer'
  | 'apple_pay'
  | 'google_pay'
  | 'account';

/**
 * Transfer transaction returned by `/api/v1/transfers/transactions`.
 *
 * @remarks
 * Purpose:
 * - Describe transfer provider deposit/withdraw activity records.
 *
 * When to use:
 * - Use when consuming transfer activity APIs or rendering transfer history UI.
 *
 * When not to use:
 * - Do not use for on-chain transaction history; use TransactionHistoryItem instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `type` is always `deposit` or `withdraw`.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - This is the end-user "deposit/withdraw activity" stream.
 * - These records are distinct from on-chain transaction history (`/api/v1/transactions/history`).
 *
 * @property id - Transaction UUID.
 * @property userId - User UUID.
 * @property type - Transfer type (`deposit`/`withdraw`).
 * @property providerId - Provider identifier.
 * @property providerName - Provider display name (best-effort).
 * @property status - Current transfer status.
 * @property networkId - Network identifier (string).
 * @property networkName - Network display name (best-effort).
 * @property account - User account identifier.
 * @property cryptoSymbol - Crypto symbol (e.g. USDC).
 * @property fiatCurrency - Fiat currency code (e.g. USD).
 * @property fiatAmount - Fiat amount string (human readable).
 * @property cryptoAmountWei - Crypto amount in base units.
 * @property tokenDecimals - Token decimals.
 * @property providerFeeFiat - Provider fee (fiat string).
 * @property networkFeeWei - Network fee (base units string).
 * @property paymentMethod - Payment method value.
 * @property contract - Token contract identifier (nullable).
 * @property transactionHash - On-chain transaction hash (nullable).
 * @property providerTransactionId - Provider transaction identifier (nullable).
 * @property providerUrl - Provider redirect URL (nullable).
 * @property failureReason - Failure reason string (nullable).
 * @property metadata - Arbitrary provider metadata blob (nullable).
 * @property createdAt - Created timestamp (ISO string).
 * @property updatedAt - Updated timestamp (nullable).
 * @property completedAt - Completed timestamp (nullable).
 *
 * @example
 * { "id": "uuid", "type": "deposit", "providerId": "moonpay", "networkId": "43113" }
 * @see /api/v1/transfers/transactions
 */
export interface TransferTransaction {
  id: string;
  userId: string;
  type: TransferTransactionType;
  providerId: string;
  providerName: string;
  status: TransferTransactionStatus;
  networkId: string;
  networkName: string;
  account: string;
  cryptoSymbol: string;
  fiatCurrency: string;
  fiatAmount: string;
  cryptoAmountWei: string;
  tokenDecimals: number;
  providerFeeFiat: string;
  networkFeeWei: string;
  paymentMethod: TransferPaymentMethod;
  contract?: string;
  transactionHash?: string;
  providerTransactionId?: string;
  providerUrl?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

/**
 * Query parameters for `/api/v1/transfers/transactions`.
 *
 * @remarks
 * Purpose:
 * - Provide filters and pagination for transfer transaction queries.
 *
 * When to use:
 * - Use when listing transfer transactions via apps/api.
 *
 * When not to use:
 * - Do not use when you need on-chain transaction history.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `offset` must be >= 0 when provided.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - Uses offset pagination (limit/offset) for this endpoint.
 *
 * @property type - Optional transfer type filter.
 * @property status - Optional status filter.
 * @property providerId - Optional provider filter.
 * @property networkId - Optional network filter.
 * @property cryptoSymbol - Optional crypto symbol filter.
 * @property startDate - Optional start date filter (ISO string).
 * @property endDate - Optional end date filter (ISO string).
 * @property limit - Optional page size (1..100).
 * @property offset - Optional offset (>= 0).
 *
 * @example
 * { "limit": 20, "offset": 0 }
 * @see /api/v1/transfers/transactions
 */
export interface TransferTransactionsQuery {
  type?: TransferTransactionType;
  status?: TransferTransactionStatus;
  providerId?: string;
  networkId?: string;
  cryptoSymbol?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Pagination envelope for `/api/v1/transfers/transactions`.
 *
 * @remarks
 * Purpose:
 * - Describe the list response for transfer transactions.
 *
 * When to use:
 * - Use when consuming raw transfer list responses from apps/api.
 *
 * When not to use:
 * - Prefer TransfersService or sdk-react hooks for normalized access.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `transactions` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - apps/api wraps responses in `{ data, request_id, timestamp }` and the SDK client unwraps `data`.
 *
 * @property transactions - Transfer transactions.
 * @property total - Total results count.
 * @property count - Returned results count.
 * @property filters - Echo of applied filters (nullable).
 * @property pagination - Additional pagination info (nullable).
 *
 * @example
 * { "transactions": [], "total": 0, "count": 0 }
 * @see /api/v1/transfers/transactions
 */
export interface TransferTransactionsListResult {
  transactions: TransferTransaction[];
  total: number;
  count: number;
  filters?: Record<string, any>;
  pagination?: Record<string, any>;
}

/**
 * Input payload for creating a transfer transaction.
 *
 * @remarks
 * Purpose:
 * - Provide payload fields for creating a transfer transaction record.
 *
 * When to use:
 * - Use when recording deposit/withdraw activity from providers or faucet flows.
 *
 * When not to use:
 * - Do not use for on-chain transfers; use signing flows instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `type` is always `deposit` or `withdraw`.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions` (apps/api).
 *
 * Notes:
 * - Backed by `POST /api/v1/transfers/transactions`.
 * - Intended for deposit/withdraw activity that originates from an external provider or faucet flow.
 *
 * @property type - Transfer type (`deposit`/`withdraw`).
 * @property providerId - Provider identifier.
 * @property networkId - Network identifier (string).
 * @property account - User account identifier.
 * @property cryptoSymbol - Crypto symbol (e.g. USDC).
 * @property fiatCurrency - Fiat currency code (e.g. USD).
 * @property fiatAmount - Fiat amount string (human readable; must be `^\d+(\.\d{1,2})?$`).
 * @property cryptoAmountWei - Expected crypto amount (base units).
 * @property paymentMethod - Payment method value.
 * @property contract - Optional token contract identifier.
 * @property userCountry - Optional user country code (ISO-3166 alpha-2).
 * @property returnUrl - Optional return URL after provider flow.
 * @property webhookUrl - Optional webhook URL for provider updates.
 * @property metadata - Optional metadata blob.
 *
 * @example
 * {
 *   "type": "deposit",
 *   "providerId": "usdc-faucet",
 *   "networkId": "43113",
 *   "account": "0x...",
 *   "cryptoSymbol": "USDC",
 *   "fiatCurrency": "USD",
 *   "fiatAmount": "1000.00",
 *   "cryptoAmountWei": "1000000000",
 *   "paymentMethod": "account"
 * }
 * @see /api/v1/transfers/transactions
 */
export interface CreateTransferTransactionInput {
  type: TransferTransactionType;
  providerId: string;
  networkId: string;
  account: string;
  cryptoSymbol: string;
  fiatCurrency: string;
  fiatAmount: string;
  cryptoAmountWei: string;
  paymentMethod: TransferPaymentMethod;
  contract?: string;
  userCountry?: string;
  returnUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Input payload for executing a faucet transfer (single-approval).
 *
 * @remarks
 * Purpose:
 * - Create and complete a faucet-backed transfer transaction in one call.
 *
 * When to use:
 * - Use with IEE (SafeApprove)-gated faucet transfers; the SDK can obtain the receipt when available.
 *
 * When not to use:
 * - Do not use for non-faucet providers; use CreateTransferTransactionInput instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `transactionHash` is a valid 32-byte hex string.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions/faucet` (apps/api).
 *
 * Notes:
 * - Backed by `POST /api/v1/transfers/transactions/faucet`.
 *
 * @property transactionHash - On-chain transaction hash returned by the IEE (SafeApprove) flow.
 *
 * @example
 * {
 *   "type": "deposit",
 *   "providerId": "usdc-faucet",
 *   "networkId": "43113",
 *   "account": "0x...",
 *   "cryptoSymbol": "USDC",
 *   "fiatCurrency": "USD",
 *   "fiatAmount": "1000.00",
 *   "cryptoAmountWei": "1000000000",
 *   "paymentMethod": "account",
 *   "transactionHash": "0x..."
 * }
 * @see /api/v1/transfers/transactions/faucet
 */
export interface ExecuteFaucetTransferInput extends CreateTransferTransactionInput {
  transactionHash: string;
}

/**
 * Input payload for updating a transfer transaction status/hash.
 *
 * @remarks
 * Purpose:
 * - Provide fields for updating transfer transaction status or hash.
 *
 * When to use:
 * - Use when a provider reports status updates or on-chain hashes.
 *
 * When not to use:
 * - Do not use when you do not have a valid transaction id.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` is a valid transfer status.
 *
 * Data/auth references:
 * - `/api/v1/transfers/transactions/:transactionId` (apps/api).
 *
 * Notes:
 * - Backed by `PATCH /api/v1/transfers/transactions/:transactionId`.
 *
 * @property status - New transfer status.
 * @property transactionHash - Optional on-chain transaction hash.
 * @property failureReason - Optional failure reason string.
 *
 * @example
 * { "status": "completed", "transactionHash": "0x..." }
 * @see /api/v1/transfers/transactions
 */
export interface UpdateTransferTransactionInput {
  status: TransferTransactionStatus;
  transactionHash?: string;
  failureReason?: string;
}

/**
 * Tenant configuration returned from `/oauth/tenant`.
 *
 * @remarks
 * Purpose:
 * - Describe tenant configuration and enabled networks/tokens/providers.
 *
 * When to use:
 * - Use when consuming tenant bootstrap data from oauth-server.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `version` is always present.
 *
 * Data/auth references:
 * - `/oauth/tenant` (oauth-server).
 *
 * Notes:
 * - Uses canonical naming (`transferProviders`).
 *
 * @property id - Tenant UUID.
 * @property slug - Tenant slug (nullable).
 * @property name - Tenant name (nullable).
 * @property environment - Tenant environment (`test`/`live`, nullable).
 * @property version - Config version (string).
 * @property networks - Enabled tenant networks.
 * @property tokens - Enabled tenant tokens.
 * @property transferProviders - Enabled transfer providers (deposit/withdraw).
 *
 * @example
 * {
 *   "id": "tenant_123",
 *   "slug": "acme",
 *   "name": "Acme",
 *   "environment": "test",
 *   "version": "42",
 *   "networks": [],
 *   "tokens": [],
 *   "transferProviders": []
 * }
 *
 * @see /oauth/tenant
 */
export interface TenantConfig {
  id: string;
  slug: string | null;
  name: string | null;
  /**
   * Tenant auth domain (primary verified `tenant_domains` entry of type `auth`).
   *
   * @remarks
   * - Used for tenant-hosted UI routes such as `/login`, `/consent`, and `/pay/:publicToken`.
   * - This is distinct from the OAuth protocol host (`OAuthService.getBaseUrl()`), which is used for `/oauth/*`.
   * - Nullable/optional for backwards compatibility if older oauth-server versions omit the field.
   */
  authDomain?: string | null;
  /**
   * Tenant environment, used for "test vs live" UX.
   *
   * @remarks
   * - Sourced from oauth-server tenant configuration (`tenants.environment`).
   * - Nullable for forward/backward compatibility if older servers omit the field.
   */
  environment: 'test' | 'live' | null;
  version: string;
  networks: TenantNetwork[];
  tokens: TokenAsset[];
  transferProviders: TransferProvider[];
}

/**
 * Bootstrap payload composed from `/oauth/user` + `/oauth/tenant`.
 *
 * @remarks
 * Purpose:
 * - Describe the combined bootstrap payload returned by oauth-server.
 *
 * When to use:
 * - Use when working with OAuthService bootstrap responses.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networks` and `tokens` mirror `tenant` values.
 *
 * Data/auth references:
 * - `/oauth/user`, `/oauth/tenant`, and `/account` (oauth-server).
 *
 * Notes:
 * - `accountState` is optional because `/oauth/user` already includes account descriptors.
 *
 * @property user - User identity payload.
 * @property tenant - Tenant configuration payload.
 * @property networks - Convenience alias for `tenant.networks`.
 * @property tokens - Convenience alias for `tenant.tokens`.
 * @property accountState - Optional account state from `GET /account`.
 * @property tokenMeta - OAuth scope metadata (nullable).
 *
 * @example
 * {
 *   "user": { "id": "user_123", "account": { "name": "account", "kind": "account", "account": "0x..." } },
 *   "tenant": { "id": "tenant_123", "version": "1", "networks": [], "tokens": [], "transferProviders": [] },
 *   "networks": [],
 *   "tokens": [],
 *   "accountState": null
 * }
 *
 * @see /oauth/user
 * @see /oauth/tenant
 * @see /account
 */
export interface BootstrapPayload {
  user: UserInfo;
  tenant: TenantConfig;
  networks: TenantNetwork[];
  tokens: TokenAsset[];
  accountState: AccountState | null;
  tokenMeta?: { scope: Scope[] };
}

/**
 * Basic profile update payload used by `PUT /oauth/user`.
 *
 * @remarks
 * Purpose:
 * - Provide payload fields for basic profile updates.
 *
 * When to use:
 * - Use when updating profile fields via oauth-server.
 *
 * When not to use:
 * - Do not use when you cannot provide at least one field.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - At least one field should be provided by callers.
 *
 * Data/auth references:
 * - `/oauth/user` (oauth-server).
 *
 * Notes:
 * - First/last name updates are supported on the OAuth server.
 * - Avatar updates use storage paths; signed URLs are returned by `/oauth/user`.
 *
 * @property firstName - Optional given name (nullable).
 * @property lastName - Optional family name (nullable).
 * @property avatarPath - Optional avatar storage path (nullable).
 *
 * @example
 * { "firstName": "Jane", "lastName": "Doe" }
 *
 * @see /oauth/user
 */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatarPath?: string | null;
}

/**
 * Signed avatar upload ticket returned by `/oauth/user/avatar/upload`.
 *
 * @remarks
 * - Use `uploadUrl` + `token` to upload the avatar to Supabase Storage.
 * - `expiresIn` is best-effort and may not be precise.
 */
export interface AvatarUploadTicket {
  bucket: string;
  path: string;
  uploadUrl: string;
  token: string;
  expiresIn?: number;
}

/**
 * Transaction status enum returned by `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Represent transaction status literals in history responses.
 *
 * When to use:
 * - Use when filtering or displaying transaction history status.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 */
export type TransactionStatus =
  | 'queued'
  | 'submitted'
  | 'pending'
  | 'success'
  | 'mined'
  | 'failed'
  | 'cancelled'
  | 'unknown';
/**
 * Transaction event type returned by `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Represent the event type classification for history rows.
 *
 * When to use:
 * - Use when filtering or grouping history records by event type.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 */
export type TransactionEventType =
  | 'token_transfer'
  | 'nft_transfer'
  | 'contract_interaction'
  | 'account_deployment';
/**
 * Transaction execution method returned by `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Represent the execution mechanism for a transaction.
 *
 * When to use:
 * - Use when distinguishing user operations vs direct or relayed execution.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals and null.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 */
export type TransactionExecutionMethod =
  | 'user_operation'
  | 'direct'
  | 'relayed'
  | null;
/**
 * Transaction direction returned by `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Represent transaction flow direction for history entries.
 *
 * When to use:
 * - Use when labeling inflows/outflows in UI.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to `in`, `out`, or `internal`.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 */
export type TransactionDirection = 'in' | 'out' | 'internal';

/**
 * Public transaction category (canonical replacement for legacy activity types).
 *
 * @remarks
 * Purpose:
 * - Represent canonical transaction categories for history rows.
 *
 * When to use:
 * - Use when grouping or filtering history entries by category.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 *
 * Notes:
 * - Derived from DB-owned `activity_type` plus direction in the API server.
 * - `transfer` is reserved for ramp activity (direction indicates in/out).
 * - `p2p` is reserved for direct account-to-account sends/receives.
 * - `escrow` is reserved for pending payment lifecycle (including cancel/release).
 *
 * @example
 * "escrow"
 *
 * @see apps/api/src/modules/transactions/dto/transaction-history.dto.ts
 */
export type TransactionCategory =
  | 'transfer'
  | 'p2p'
  | 'escrow'
  | 'agent'
  | 'other';

/**
 * Canonical transaction status emitted by apps/api for feed consumers.
 *
 * @remarks
 * Purpose:
 * - Represent API-owned normalized status values for transaction feed rows.
 *
 * When to use:
 * - Use for UI status display and state handling in transaction feeds.
 *
 * When not to use:
 * - Do not infer this from raw `status`; consume the API-provided canonical field directly.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 */
export type TransactionStatusCanonical =
  | 'queued'
  | 'pending'
  | 'success'
  | 'failed'
  | 'unknown';

/**
 * Canonical transaction provenance emitted by apps/api.
 *
 * @remarks
 * Purpose:
 * - Represent semantic provenance of a feed row without UI-side inference.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 */
export type TransactionProvenance =
  | 'known_flow'
  | 'indexer'
  | 'external'
  | 'unknown';

/**
 * Canonical transaction image source emitted by apps/api.
 *
 * @remarks
 * Purpose:
 * - Describe which semantic source resolved the row image.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 */
export type TransactionImageSource =
  | 'ramp_provider'
  | 'agent_icon'
  | 'counterparty_avatar'
  | 'network_logo'
  | 'fallback';

/**
 * Optional evidence payload used for provenance diagnostics.
 *
 * @remarks
 * Purpose:
 * - Expose producer/correlation evidence without requiring SDK-side semantic inference.
 */
export interface TransactionProvenanceEvidence {
  source: string | null;
  hasQueueId: boolean;
  hasUserOpHash: boolean;
  hasFingerprint: boolean;
  hasTransactionHash: boolean;
  hasAgentCorrelation: boolean;
}

/**
 * Canonical counterparty type emitted by apps/api.
 */
export type TransactionCounterpartyType =
  | 'agent'
  | 'user'
  | 'external'
  | 'ramp_provider'
  | 'system'
  | 'unknown';

/**
 * Canonical counterparty payload emitted by apps/api.
 */
export interface TransactionCounterparty {
  type: TransactionCounterpartyType;
  primaryLabel: string | null;
  secondaryLabel: string | null;
  account: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Canonical transaction image payload emitted by apps/api.
 */
export interface TransactionImage {
  url: string | null;
  source: TransactionImageSource;
  alt: string | null;
}

/**
 * Transaction record returned by `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Describe a transaction history row returned by apps/api.
 *
 * When to use:
 * - Use when consuming transaction history APIs or history hooks.
 *
 * When not to use:
 * - Do not use for transfer-provider activity; use TransferTransaction instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `category` is always present; `networkId` is numeric.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 *
 * Notes:
 * - Uses canonical account/network terminology and `category` instead of legacy `activityType`.
 *
 * @property id - Transaction UUID.
 * @property stableRowId - Deterministic stable row identity (opaque).
 * @property tenantId - Tenant UUID.
 * @property account - Primary account identifier.
 * @property fromAccount - Sender account identifier.
 * @property toAccount - Recipient account identifier (nullable).
 * @property direction - Transaction direction (in/out/internal).
 * @property transactionHash - Transaction hash (nullable).
 * @property logIndex - Log index within the block (nullable).
 * @property rowInLog - Row order within a decoded log (nullable).
 * @property networkId - Network identifier (numeric).
 * @property blockNumber - Block number (nullable).
 * @property blockTimestamp - Block timestamp (nullable).
 * @property eventType - Event type (token_transfer, nft_transfer, etc).
 * @property eventSubtype - Event subtype (nullable).
 * @property executionMethod - Execution method (nullable).
 * @property status - Transaction status.
 * @property statusCanonical - Canonical feed status.
 * @property amountRaw - Amount in base units (nullable).
 * @property contract - Token/NFT contract identifier (nullable).
 * @property tokenSymbol - Token symbol (nullable).
 * @property tokenDecimals - Token decimals (nullable).
 * @property tokenId - NFT token id (nullable).
 * @property nftTokenStandard - NFT standard (nullable).
 * @property nftValue - NFT value (nullable).
 * @property gasUsed - Gas used (nullable).
 * @property feeWei - Fee in wei (nullable).
 * @property userOpHash - UserOperation hash (nullable).
 * @property userOpNonce - UserOperation nonce (nullable).
 * @property userOpPaymaster - UserOperation paymaster (nullable).
 * @property queueId - Queue identifier (nullable).
 * @property revertReason - Revert reason (nullable).
 * @property agentServiceId - Agent service id (nullable).
 * @property agentServiceName - Agent service name (nullable).
 * @property agentInstallationId - Agent installation id (nullable).
 * @property category - Canonical category (transfer, p2p, escrow, agent, other).
 * @property assetType - Asset type classification.
 * @property agentPass - Agent pass identifier (nullable).
 * @property source - Transaction source (nullable).
 * @property queuedAt - Queued timestamp (nullable).
 * @property minedAt - Mined timestamp (nullable).
 * @property indexedAt - Indexed timestamp (nullable).
 * @property createdAt - Created timestamp.
 * @property updatedAt - Updated timestamp.
 * @property provenance - Canonical provenance classification.
 * @property provenanceEvidence - Optional provenance evidence payload (nullable).
 * @property counterparty - Canonical counterparty payload.
 * @property image - Canonical image payload.
 * @property displaySnapshotVersion - Display snapshot version emitted by API.
 * @property displaySnapshotAt - Display snapshot timestamp (nullable).
 * @property metadata - Optional metadata blob (nullable).
 * @property movements - Grouped asset movements when view=grouped (nullable).
 *
 * @example
 * {
 *   "id": "tx_123",
 *   "tenantId": "tenant_123",
 *   "account": "0x1234...",
 *   "fromAccount": "0x1234...",
 *   "toAccount": "0x5678...",
 *   "direction": "out",
 *   "networkId": 43113,
 *   "category": "transfer"
 * }
 *
 * @see /api/v1/transactions/history
 */
export interface TransactionHistoryItem {
  id: string;
  stableRowId: string;
  tenantId: string;
  account: string;
  fromAccount: string;
  toAccount: string | null;
  direction: TransactionDirection;
  transactionHash: string | null;
  logIndex?: number | null;
  rowInLog?: number | null;
  networkId: number;
  blockNumber: number | null;
  blockTimestamp: string | null;
  eventType: TransactionEventType;
  eventSubtype: string | null;
  executionMethod: TransactionExecutionMethod;
  status: TransactionStatus;
  statusCanonical: TransactionStatusCanonical;
  amountRaw: string | null;
  contract: string | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  tokenId: string | null;
  nftTokenStandard: string | null;
  nftValue: string | null;
  gasUsed: string | null;
  feeWei: string | null;
  userOpHash: string | null;
  userOpNonce: string | null;
  userOpPaymaster: string | null;
  queueId: string | null;
  revertReason: string | null;
  agentServiceId: string | null;
  agentServiceName: string | null;
  agentInstallationId: string | null;
  category: TransactionCategory;
  assetType:
    | 'native'
    | 'token'
    | 'nft'
    | 'mixed'
    | 'contract'
    | 'deployment'
    | 'other';
  agentPass: string | null;
  source: string | null;
  queuedAt: string | null;
  minedAt: string | null;
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
  provenance: TransactionProvenance;
  provenanceEvidence?: TransactionProvenanceEvidence | null;
  counterparty: TransactionCounterparty;
  image: TransactionImage;
  displaySnapshotVersion: string;
  displaySnapshotAt: string | null;
  metadata?: Record<string, unknown> | null;
  movements?: Array<{
    eventType: TransactionEventType;
    eventSubtype: string | null;
    direction: TransactionDirection;
    fromAccount: string;
    toAccount: string | null;
    amountRaw: string | null;
    contract: string | null;
    tokenSymbol: string | null;
    tokenDecimals: number | null;
    tokenId: string | null;
    nftTokenStandard: string | null;
    nftValue: string | null;
  }>;
}

/**
 * Pagination envelope for `/api/v1/transactions/history`.
 *
 * @remarks
 * Purpose:
 * - Describe the transaction history list response.
 *
 * When to use:
 * - Use when consuming raw history list responses from apps/api.
 *
 * When not to use:
 * - Prefer TransactionHistoryService or sdk-react hooks for normalized access.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `transactions` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/transactions/history` (apps/api).
 *
 * Notes:
 * - Uses cursor-based pagination; `offset` remains deprecated for legacy callers.
 *
 * @property transactions - Transaction items.
 * @property total - Total count (display use).
 * @property limit - Page size.
 * @property offset - Deprecated offset (legacy only).
 * @property hasMore - Whether more results exist (nullable).
 * @property nextCursor - Cursor for next page (nullable).
 * @property prevCursor - Cursor for previous page (nullable).
 *
 * @example
 * { "transactions": [], "total": 0, "limit": 50, "offset": 0 }
 *
 * @see /api/v1/transactions/history
 */
export interface TransactionHistoryResponse {
  transactions: TransactionHistoryItem[];
  total: number;
  limit: number;
  /** @deprecated Use cursor-based pagination instead */
  offset: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  prevCursor?: string | null;
}

/**
 * Send payment record returned by `/api/v1/payments/send`.
 *
 * @remarks
 * Purpose:
 * - Represent a send payment record returned by apps/api.
 *
 * When to use:
 * - Use when consuming `/api/v1/payments/send` responses from SDK services.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `amountWei` is a base-unit string.
 * - `networkId` is a string identifier; contract identifiers are 0x-prefixed.
 *
 * Data/auth references:
 * - `/api/v1/payments/send` (apps/api, bearer token).
 *
 * @property id - Send payment identifier.
 * @property senderUserId - Sender profile identifier (nullable).
 * @property transactionType - Transaction type classification.
 * @property amountWei - Payment amount in base units (string).
 * @property contract - Token contract identifier.
 * @property tokenSymbol - Token symbol (nullable).
 * @property tokenDecimals - Token decimals (nullable).
 * @property recipientProfileId - Recipient profile identifier (nullable).
 * @property recipientContact - Contact identifier (email/phone/account).
 * @property contactType - Contact type hint (nullable).
 * @property recipientEmail - Recipient email (nullable).
 * @property recipientName - Recipient display name (nullable).
 * @property recipientAccount - Recipient account identifier (nullable).
 * @property senderAccount - Sender account identifier (nullable).
 * @property jwtToken - Pending payment claim token (nullable).
 * @property description - Optional memo (nullable).
 * @property status - Payment status string.
 * @property networkId - Network identifier (string).
 * @property fingerprint - Pending payment fingerprint identifier.
 * @property isPendingPayment - True when this is a pending payment.
 * @property expiresAt - Expiration timestamp (nullable).
 * @property transactionHash - On-chain transaction hash (nullable).
 * @property failureReason - Failure reason (nullable).
 * @property metadata - Metadata blob (nullable).
 * @property createdAt - Creation timestamp.
 * @property completedAt - Completion timestamp (nullable).
 * @property updatedAt - Update timestamp (nullable).
 *
 * @example
 * { "id": "pay_123", "amountWei": "1000", "contract": "0x...", "networkId": "43113" }
 *
 * @see /api/v1/payments/send
 */
export interface SendPayment {
  id: string;
  senderUserId?: string;
  transactionType?: string;
  amountWei: string;
  contract: string;
  tokenSymbol?: string | null;
  tokenDecimals?: number | null;
  recipientProfileId?: string | null;
  recipientContact: string;
  contactType?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  recipientAccount?: string | null;
  senderAccount?: string | null;
  jwtToken?: string | null;
  description?: string | null;
  status: string;
  networkId: string;
  fingerprint: string;
  isPendingPayment: boolean;
  expiresAt?: string | null;
  transactionHash?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  completedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Query parameters for `/api/v1/payments/send`.
 *
 * @remarks
 * Purpose:
 * - Filter send payment history responses from apps/api.
 *
 * When to use:
 * - Use with SendPaymentsService.listSendPayments.
 *
 * When not to use:
 * - Do not use for payment requests; use PaymentRequestsQuery instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `limit` should be within API bounds when provided.
 *
 * @property transactionType - Transaction type filter (nullable).
 * @property status - Status filter (nullable).
 * @property recipientAccount - Recipient account filter (nullable).
 * @property isPendingPayment - Pending payment filter (nullable).
 * @property startDate - Start date filter (ISO string, nullable).
 * @property endDate - End date filter (ISO string, nullable).
 * @property limit - Page size (nullable).
 * @property offset - Offset pagination (nullable).
 *
 * @example
 * { "status": "completed", "limit": 20 }
 *
 * Data/auth references:
 * - apps/api `/api/v1/payments/send` endpoint.
 */
export interface SendPaymentsQuery {
  transactionType?: string;
  status?: string;
  recipientAccount?: string;
  isPendingPayment?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * List response for `/api/v1/payments/send`.
 *
 * @remarks
 * Purpose:
 * - Describe the send payment history list response.
 *
 * When to use:
 * - Use with SendPaymentsService.listSendPayments.
 *
 * When not to use:
 * - Do not use for payment requests; use PaymentRequestsListResponse instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `payments` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/payments/send` (apps/api).
 *
 * @property payments - Send payment records.
 * @property total - Total number of matching payments.
 * @property count - Count of returned payments.
 * @property filters - Applied filters (nullable).
 *
 * @example
 * { "payments": [], "total": 0, "count": 0 }
 */
export interface SendPaymentsListResult {
  payments: SendPayment[];
  total: number;
  count: number;
  filters?: Record<string, any>;
}

/**
 * Result for send payment actions (cancel/remind/etc).
 *
 * @remarks
 * Purpose:
 * - Describe action responses for send payment mutation endpoints.
 *
 * When to use:
 * - Use when handling results from SendPaymentsService write methods.
 *
 * When not to use:
 * - Do not use for payment requests; use PaymentRequestActionResult instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `success` is boolean and `message` is always present.
 *
 * Data/auth references:
 * - apps/api `/api/v1/payments/send/*` action endpoints.
 *
 * @property success - True when the action succeeded.
 * @property message - Human-friendly result message.
 * @property payment - Updated payment record (nullable).
 * @property actionTimestamp - Action timestamp (nullable).
 *
 * @example
 * { "success": true, "message": "Payment cancelled", "payment": { "id": "pay_123" } }
 */
export interface PaymentActionResult {
  success: boolean;
  message: string;
  payment?: SendPayment;
  actionTimestamp?: string;
}

/**
 * Transaction verification result for send payments.
 *
 * @remarks
 * Purpose:
 * - Describe verification responses when checking send-payment transaction hashes.
 *
 * When to use:
 * - Use with SendPaymentsService.verifySendPayment results.
 *
 * When not to use:
 * - Do not use for payment request actions.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `isValid` indicates server verification outcome.
 *
 * Data/auth references:
 * - apps/api `/api/v1/payments/send/:paymentId/verify`.
 *
 * @property isValid - True when the transaction hash is valid for the payment.
 * @property message - Human-friendly verification message.
 * @property transactionDetails - Optional transaction detail payload.
 * @property verifiedAt - Verification timestamp (nullable).
 *
 * @example
 * { "isValid": true, "message": "Transaction verified" }
 */
export interface TransactionVerificationResult {
  isValid: boolean;
  message: string;
  transactionDetails?: any;
  verifiedAt?: string;
}

/**
 * Payment request record returned by `/api/v1/payments/requests/*`.
 *
 * @remarks
 * Purpose:
 * - Represent a payment request record returned by apps/api.
 *
 * When to use:
 * - Use when consuming payment request list responses from SDK services.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `networkId` is a string identifier; `account` is a 0x-prefixed identifier.
 *
 * Data/auth references:
 * - `/api/v1/payments/requests/*` (apps/api, bearer token).
 *
 * @property id - Payment request identifier.
 * @property requestId - Human-readable request identifier.
 * @property publicToken - Public lookup token (opaque).
 * @property requesterUserId - Requester profile identifier.
 * @property requesterEmail - Requester email address (nullable).
 * @property type - Request type (P2P or BUSINESS).
 * @property transactionType - Transaction classification (nullable).
 * @property amountWei - Requested amount in base units.
 * @property feeAmountWei - Fee amount in base units (nullable).
 * @property account - Recipient account identifier.
 * @property recipientEmail - Recipient email (nullable).
 * @property payerEmail - Payer email (nullable).
 * @property payerFirstName - Payer first name (nullable).
 * @property payerLastName - Payer last name (nullable).
 * @property description - Optional memo (nullable).
 * @property tokenSymbol - Token symbol (nullable).
 * @property contract - Token contract identifier (nullable).
 * @property tokenDecimals - Token decimals (nullable).
 * @property status - Payment request status string.
 * @property currency - Currency code (nullable).
 * @property tenantId - Tenant identifier (nullable).
 * @property networkId - Network identifier (string).
 * @property storeId - Store identifier (nullable).
 * @property businessId - Business identifier (nullable).
 * @property orderId - Merchant order identifier (nullable).
 * @property returnUrl - Return URL (nullable).
 * @property cancelUrl - Cancel URL (nullable).
 * @property createdAt - Created timestamp.
 * @property expiresAt - Expiration timestamp (nullable).
 * @property completedAt - Completion timestamp (nullable).
 * @property transactionHash - On-chain transaction hash (nullable).
 *
 * @example
 * { "id": "req_123", "account": "0x...", "networkId": "43113", "amountWei": "1000" }
 *
 * @see /api/v1/payments/requests
 */
export interface PaymentRequest {
  id: string;
  requestId: string;
  publicToken: string;
  requesterUserId: string;
  requesterEmail?: string;
  type: 'P2P' | 'BUSINESS';
  transactionType?: string;
  amountWei: string;
  feeAmountWei?: string;
  account: string;
  recipientEmail?: string;
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  description?: string;
  tokenSymbol?: string;
  contract?: string;
  tokenDecimals?: number;
  status: string;
  currency?: string;
  tenantId?: string;
  networkId: string;
  storeId?: string;
  businessId?: string;
  orderId?: string;
  returnUrl?: string;
  cancelUrl?: string;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
  transactionHash?: string | null;
}

/**
 * Result for payment request actions (cancel/decline/remind).
 *
 * @remarks
 * Purpose:
 * - Describe action responses for payment request mutation endpoints.
 *
 * When to use:
 * - Use with PaymentRequestsService write methods.
 *
 * When not to use:
 * - Do not use for send payment actions; use PaymentActionResult instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `success` is boolean and `message` is always present.
 *
 * Data/auth references:
 * - apps/api `/api/v1/payments/requests/*` action endpoints.
 *
 * @property success - True when the action succeeded.
 * @property message - Human-friendly result message.
 * @property paymentRequest - Updated payment request record (nullable).
 * @property actionTimestamp - Action timestamp (nullable).
 *
 * @example
 * { "success": true, "message": "Request cancelled", "paymentRequest": { "id": "req_123" } }
 */
export interface PaymentRequestActionResult {
  success: boolean;
  message: string;
  paymentRequest?: PaymentRequest;
  actionTimestamp?: string;
}

/**
 * Query parameters for `/api/v1/payments/requests/*`.
 *
 * @remarks
 * Purpose:
 * - Filter payment request history responses from apps/api.
 *
 * When to use:
 * - Use with PaymentRequestsService list methods.
 *
 * When not to use:
 * - Do not use for send payments; use SendPaymentsQuery instead.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `limit` should be within API bounds when provided.
 *
 * @property type - Request type filter (nullable).
 * @property status - Status filter (nullable).
 * @property account - Account filter (nullable).
 * @property startDate - Start date filter (ISO string, nullable).
 * @property endDate - End date filter (ISO string, nullable).
 * @property limit - Page size (nullable).
 * @property offset - Offset pagination (nullable).
 *
 * @example
 * { "status": "pending", "limit": 20 }
 *
 * Data/auth references:
 * - apps/api `/api/v1/payments/requests/*` endpoints.
 */
export interface PaymentRequestsQuery {
  type?: 'P2P' | 'BUSINESS';
  status?: string;
  account?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Raw list response shape for payment request endpoints.
 *
 * @remarks
 * Purpose:
 * - Capture the response fields returned by apps/api payment request list endpoints.
 *
 * When to use:
 * - Use with PaymentRequestsService list methods.
 *
 * When not to use:
 * - Prefer normalized results from sdk-react request history hooks.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Lists may be empty.
 *
 * @property requests - List of payment requests (legacy field).
 * @property paymentRequests - List of payment requests (current field).
 * @property total - Total matching requests.
 * @property count - Count of returned requests.
 * @property filters - Server-applied filters metadata.
 * Data/auth references:
 * - apps/api `/api/v1/payments/requests/*` endpoints.
 */
export interface PaymentRequestsListResponse {
  requests?: PaymentRequest[];
  paymentRequests?: PaymentRequest[];
  total?: number;
  count?: number;
  filters?: Record<string, any>;
}

/**
 * Agent metadata exposed to the public SDK.
 *
 * @remarks
 * Purpose:
 * - Represent high-level agent metadata for UI and selection flows.
 *
 * When to use:
 * - Use when rendering agent lists or summaries.
 *
 * When not to use:
 * - Do not assume optional fields are present.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `id` is present when provided by upstream services.
 *
 * Data/auth references:
 * - Not tied to a single endpoint; used as a shared SDK shape.
 */
export interface AgentDescriptor {
  id: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  category?: string;
  developerName?: string;
  permissions?: Scope[];
  pricing?: string;
}

/**
 * Agent installation status snapshot.
 *
 * @remarks
 * Purpose:
 * - Represent current install status and budget usage for an agent.
 *
 * When to use:
 * - Use when displaying installation status or quotas.
 *
 * When not to use:
 * - Do not assume budget fields are present; they are optional.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` is one of the allowed literals.
 *
 * Data/auth references:
 * - Not tied to a single endpoint; used by SDK agent summaries.
 */
export interface AgentInstallation {
  agentId: string;
  status: 'not-installed' | 'pending' | 'installed' | 'suspended';
  budget?: {
    total: number;
    used: number;
    remaining: number;
    currency?: string;
  };
  scopes?: Scope[];
  metadata?: Record<string, unknown>;
}

/**
 * Agent category enum for marketplace.
 *
 * @remarks
 * Purpose:
 * - Represent the marketplace category classification for agents.
 *
 * When to use:
 * - Use when filtering or labeling marketplace agent entries.
 *
 * When not to use:
 * - Do not invent new values; server controls the literal set.
 *
 * Return semantics:
 * - Type alias only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Values are limited to the listed literals.
 *
 * Data/auth references:
 * - `/marketplace/tenant/catalog` (oauth-server).
 */
export type AgentCategory =
  | 'payments'
  | 'commerce'
  | 'analytics'
  | 'ops'
  | 'tooling'
  | 'misc';

/**
 * Fee summary for agent transactions (basis points).
 */
export interface FeeSummary {
  platformFeeBps: number;
  tenantFeeBps: number;
  totalFeeBps: number;
  developerRemainderBps: number;
}

/**
 * Fee schedule snapshot bound at installation time.
 */
export interface FeeScheduleSnapshot {
  schemaVersion: number;
  tenantFeeBps: number;
  boundAt: string;
  source: {
    tenantFeeConfigUpdatedAt: string | null;
    updatedByUserId: string | null;
  };
}

/**
 * Marketplace agent entry (from marketplace catalog endpoints).
 *
 * @remarks
 * Purpose:
 * - Describe marketplace catalog entries returned by catalog endpoints.
 *
 * When to use:
 * - Use when rendering marketplace catalogs or agent discovery UI.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `agentServiceId` is always present.
 *
 * Data/auth references:
 * - `/marketplace/catalog` and `/marketplace/tenant/catalog`.
 *
 * Notes:
 * - Uses canonical network/contract naming (no legacy field names).
 *
 * @property id - Marketplace catalog UUID.
 * @property agentServiceId - Agent service UUID.
 * @property displayName - Agent display name.
 * @property description - Agent description (nullable).
 * @property avatarUrl - Agent avatar URL (nullable).
 * @property iconUrl - Marketplace icon URL (nullable).
 * @property bannerUrl - Marketplace banner URL (nullable).
 * @property publisherUrl - Publisher homepage URL (nullable).
 * @property publisherName - Publisher display name (nullable).
 * @property contactEmail - Support email (nullable).
 * @property supportUrl - Support URL (nullable).
 * @property privacyPolicyUrl - Privacy policy URL (nullable).
 * @property termsUrl - Terms URL (nullable).
 * @property tags - Marketplace tags (nullable).
 * @property releaseNotes - Release notes (nullable).
 * @property network - Operating network (nullable).
 * @property operatingToken - Operating token (nullable).
 * @property availableOperatingTokens - Compatible token options for installation (nullable).
 * @property minimumBudgetByTokenPoolId - Optional per-token minimum budgets keyed by tokenPoolId.
 * @property category - Marketplace category.
 * @property pricingModel - Pricing model (nullable).
 * @property pricingDetails - Pricing metadata.
 * @property feeSummary - Platform + tenant fee summary for the current tenant context (nullable).
 * @property minimumBudget - Minimum budget in base units (nullable).
 * @property minValidityDays - Minimum allowed validity in days for installs (nullable).
 * @property defaultValidityDays - Default validity in days used by install UIs (nullable).
 * @property maxValidityDays - Maximum allowed validity in days for installs (nullable).
 * @property status - Marketplace status.
 * @property featured - Featured flag.
 * @property featuredOrder - Featured order (nullable).
 * @property installCount - Install count.
 * @property createdAt - Created timestamp.
 * @property updatedAt - Updated timestamp.
 *
 * @example
 * {
 *   "id": "agent_123",
 *   "agentServiceId": "svc_123",
 *   "displayName": "Acme Agent",
 *   "category": "payments",
 *   "status": "approved"
 * }
 *
 * @see /marketplace/catalog
 * @see /marketplace/tenant/catalog
 */
export interface MarketplaceAgent {
  id: string;
  agentServiceId: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  publisherUrl?: string | null;
  publisherName?: string | null;
  contactEmail?: string | null;
  supportUrl?: string | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  tags?: string[];
  releaseNotes?: string | null;
  network?: {
    networkId: string;
    name: string;
    nativeCurrency?: { symbol: string; name: string; decimals: number };
    isTestnet?: boolean;
  } | null;
  operatingToken?: {
    tokenPoolId: string;
    symbol: string;
    name: string;
    contract: string;
    decimals: number;
    isStable?: boolean;
    logoUrl?: string | null;
  } | null;
  availableOperatingTokens?: Array<{
    tokenPoolId: string;
    symbol: string;
    name: string;
    contract: string;
    decimals: number;
    isStable?: boolean;
    logoUrl?: string | null;
    minimumBudget?: string | null;
  }> | null;
  category: AgentCategory;
  pricingModel: 'free' | 'flat' | 'percentage' | 'usage' | null;
  pricingDetails: Record<string, unknown>;
  feeSummary?: FeeSummary | null;
  minimumBudget: string | null;
  minimumBudgetByTokenPoolId?: Record<string, string> | null;
  minValidityDays?: number | null;
  defaultValidityDays?: number | null;
  maxValidityDays?: number | null;
  installQuestions?: AgentInstallQuestion[];
  installQuestionsVersion?: number | null;
  status: 'pending' | 'approved' | 'suspended' | 'deprecated';
  featured: boolean;
  featuredOrder: number | null;
  installCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent install question select option.
 *
 * @remarks
 * Purpose:
 * - Describe one option entry for a select-style install question.
 *
 * @property value - Canonical value persisted in install_inputs.
 * @property label - Optional UI label shown to users.
 */
export interface AgentInstallQuestionOption {
  value: string;
  label?: string;
}

/**
 * Agent install question schema entry.
 *
 * @remarks
 * Purpose:
 * - Describe developer-defined install questions for agent configuration.
 *
 * @property key - Stable snake_case key for the answer.
 * @property label - User-facing prompt.
 * @property type - Input type (`text`, `number`, or `select`).
 * @property required - Whether a value is required.
 * @property default - Default value when the user leaves it blank.
 * @property min - Minimum value for numeric inputs.
 * @property max - Maximum value for numeric inputs.
 * @property step - Step size for numeric inputs.
 * @property unit - Display unit string for numeric inputs.
 * @property sensitive - Hide values in UI echoes when true.
 * @property options - Select options when `type` is `select`.
 * @property allow_custom - Whether select questions allow custom values outside configured options.
 */
export interface AgentInstallQuestion {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  default?: string | number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  sensitive?: boolean;
  options?: AgentInstallQuestionOption[];
  allow_custom?: boolean;
}

/**
 * Full agent installation details returned by `/agents`.
 *
 * @remarks
 * Purpose:
 * - Describe agent installation details returned by oauth-server.
 *
 * When to use:
 * - Use when listing or inspecting user installations.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `agentPass` and `account` are 0x-prefixed identifiers.
 *
 * Data/auth references:
 * - `/agents` and `/agents/:agentActorId` (oauth-server).
 *
 * Notes:
 * - Uses canonical naming (`agentPass`, `account`, `networkId`).
 *
 * @property installationId - Installation UUID.
 * @property agentActorId - Agent actor UUID.
 * @property agentServiceId - Agent service UUID.
 * @property status - Normalized installation status.
 * @property rawStatus - Raw installation status (nullable).
 * @property revocationPending - True when revocation is in progress (nullable).
 * @property installLabel - Install label.
 * @property installedAt - Install timestamp.
 * @property agentPass - Agent pass identifier.
 * @property account - Account identifier.
 * @property networkId - Network identifier (numeric).
 * @property transactionCountByTokenPoolId - Per-token transaction counts keyed by tokenPoolId (nullable).
 * @property feeSchedule - Fee schedule snapshot bound at install (nullable).
 * @property feeSummary - Fee summary derived from platform + tenant fees (nullable).
 * @property revokeReason - Revocation reason (nullable).
 * @property pauseCode - Pause code (nullable).
 * @property blacklistActive - True when installation is paused via tenant blacklist policy.
 * @property blacklistCode - Blacklist reason code (nullable).
 * @property blacklistReason - Human-readable blacklist reason (nullable).
 * @property operatingToken - Installation-selected operating token snapshot (nullable).
 * @property availableOperatingTokens - Installation-available operating token snapshots (nullable).
 * @property tokenSymbolsByTokenPoolId - Token symbols keyed by tokenPoolId (nullable).
 * @property tokenBudgetsByTokenPoolId - Per-token budgets keyed by tokenPoolId (base units, nullable).
 * @property tokenBudgetUsedByTokenPoolId - Per-token used budget keyed by tokenPoolId (base units, nullable).
 * @property tokenBudgetMode - Token budget mode used at install time (`single` or `all`, nullable).
 * @property service - Marketplace agent metadata.
 *
 * @example
 * {
 *   "installationId": "inst_123",
 *   "agentServiceId": "svc_123",
 *   "status": "active",
 *   "agentPass": "0x1234...",
 *   "account": "0x5678...",
 *   "networkId": 43113
 * }
 *
 * @see /agents
 * @see /agents/:agentActorId
 */
export interface AgentInstallationDetails {
  installationId: string;
  agentActorId: string;
  agentServiceId: string;
  status: 'pending' | 'active' | 'paused' | 'suspended' | 'revoked';
  rawStatus?: string;
  revocationPending?: boolean;
  installLabel: string;
  installedAt: string;
  agentPass: string;
  account: string;
  networkId: number;
  transactionCountByTokenPoolId?: Record<string, number> | null;
  feeSchedule?: FeeScheduleSnapshot | null;
  feeSummary?: FeeSummary | null;
  revokeReason?: string | null;
  pauseCode?: string | null;
  blacklistActive?: boolean;
  blacklistCode?: string | null;
  blacklistReason?: string | null;
  operatingToken?: {
    tokenPoolId: string;
    symbol: string;
    name: string;
    contract: string | null;
    decimals: number | null;
    isStable?: boolean | null;
    logoUrl?: string | null;
  } | null;
  availableOperatingTokens?: Array<{
    tokenPoolId: string;
    symbol: string | null;
    name: string | null;
    contract: string | null;
    decimals: number | null;
    isStable?: boolean | null;
    networkPoolId?: string | null;
    logoUrl?: string | null;
    minimumBudget?: string | null;
  }> | null;
  tokenSymbolsByTokenPoolId?: Record<string, string> | null;
  tokenBudgetsByTokenPoolId?: Record<string, string> | null;
  tokenBudgetUsedByTokenPoolId?: Record<string, string> | null;
  tokenBudgetMode?: "single" | "all" | null;
  installInputs?: Record<string, string>;
  installQuestions?: AgentInstallQuestion[];
  installQuestionsVersion?: number | null;
  service: {
    name: string;
    displayName: string;
    description: string;
    avatarUrl: string | null;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    marketplaceStatus: string;
  };
}

/**
 * Result returned by agent uninstall/revoke operations.
 *
 * @remarks
 * Purpose:
 * - Describe uninstall outcomes, including pending signature cases.
 *
 * When to use:
 * - Use after calling agent uninstall endpoints.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - Union type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `installationId` is present in all variants.
 *
 * Data/auth references:
 * - `/agents/:agentActorId` (oauth-server).
 */
export type UninstallAgentResult =
  | { status: 'revoked'; installationId: string }
  | {
      status: 'pending_signature';
      installationId: string;
      unsignedTransaction: unknown;
      thirdwebClientId: string;
    };

/**
 * Failure record for an agent installation.
 *
 * @remarks
 * Purpose:
 * - Describe a single failure record tied to an agent installation.
 *
 * When to use:
 * - Use when listing installation failure history.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `installationId` is always present.
 *
 * Data/auth references:
 * - `/api/v1/transactions/installations/:installationId/failures` (apps/api).
 *
 * Notes:
 * - Sourced from `/api/v1/transactions/installations/:id/failures`.
 *
 * @property id - Failure UUID.
 * @property installationId - Agent installation UUID.
 * @property createdAt - Failure timestamp.
 * @property failureType - Failure type string.
 * @property failureReason - Failure reason string.
 * @property errorCode - Error code (nullable).
 * @property transactionTo - Transaction destination identifier (nullable).
 * @property transactionValue - Transaction value string (nullable).
 * @property networkId - Network identifier (nullable).
 *
 * @example
 * { "id": "fail_123", "installationId": "inst_123", "failureType": "policy" }
 *
 * @see /api/v1/transactions/installations/:installationId/failures
 */
export interface AgentInstallationFailure {
  id: string;
  installationId: string;
  createdAt: string;
  failureType: string;
  failureReason: string;
  errorCode: string | null;
  transactionTo: string | null;
  transactionValue: string | null;
  networkId: number | null;
}

/**
 * Failure list response for an installation.
 *
 * @remarks
 * Purpose:
 * - Describe the list response for installation failures.
 *
 * When to use:
 * - Use when consuming failure list endpoints.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `failures` is always an array.
 *
 * Data/auth references:
 * - `/api/v1/transactions/installations/:installationId/failures` (apps/api).
 *
 * Notes:
 * - Returned by `/api/v1/transactions/installations/:id/failures`.
 *
 * @property installationId - Agent installation UUID.
 * @property failures - Failure records.
 * @property total - Total failure count.
 * @property limit - Page size.
 * @property offset - Offset (legacy).
 *
 * @example
 * { "installationId": "inst_123", "failures": [], "total": 0, "limit": 20, "offset": 0 }
 *
 * @see /api/v1/transactions/installations/:installationId/failures
 */
export interface AgentInstallationFailuresResponse {
  installationId: string;
  failures: AgentInstallationFailure[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Failure count response for an installation.
 *
 * @remarks
 * Purpose:
 * - Describe the failure count response for a single installation.
 *
 * When to use:
 * - Use when displaying failure counts for installations.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `total` is always numeric.
 *
 * Data/auth references:
 * - `/api/v1/transactions/installations/:installationId/failures/count` (apps/api).
 *
 * Notes:
 * - Returned by `/api/v1/transactions/installations/:id/failures/count`.
 *
 * @property installationId - Agent installation UUID.
 * @property total - Failure count (pre-submission + on-chain).
 * @property onChainFailures - Failed on-chain submissions.
 * @property preSubmissionFailures - Failures before submission (validation, budget, policy).
 *
 * @example
 * { "installationId": "inst_123", "total": 4 }
 *
 * @see /api/v1/transactions/installations/:installationId/failures/count
 */
export interface AgentInstallationFailureCountResponse {
  installationId: string;
  total: number;
  onChainFailures?: number;
  preSubmissionFailures?: number;
}

/**
 * Failure count breakdown for an installation.
 *
 * @remarks
 * Purpose:
 * - Separate pre-submission failures from on-chain failures.
 *
 * When to use:
 * - Use when rendering developer diagnostics or issue breakdowns.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `total` is always numeric.
 *
 * Data/auth references:
 * - `/api/v1/transactions/installations/{installationId}/failures/count(s)` (apps/api).
 *
 * @property total - Failure count (pre-submission + on-chain).
 * @property onChainFailures - Failed on-chain submissions.
 * @property preSubmissionFailures - Failures before submission (validation, budget, policy).
 */
export interface AgentInstallationFailureBreakdown {
  total: number;
  onChainFailures: number;
  preSubmissionFailures: number;
}

/**
 * Batch failure count response for installations.
 *
 * @remarks
 * Purpose:
 * - Describe failure counts for multiple installations.
 *
 * When to use:
 * - Use when fetching batch failure counts.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `counts` is always a dictionary.
 *
 * Data/auth references:
 * - `/api/v1/transactions/installations/failures/counts` (apps/api).
 *
 * Notes:
 * - Returned by `/api/v1/transactions/installations/failures/counts`.
 *
 * @property counts - Mapping of installationId -> failure count.
 * @property breakdowns - Mapping of installationId -> failure breakdown (optional).
 *
 * @example
 * { "counts": { "inst_123": 2 } }
 *
 * @see /api/v1/transactions/installations/failures/counts
 */
export interface AgentInstallationFailureCountsResponse {
  counts: Record<string, number>;
  breakdowns?: Record<string, AgentInstallationFailureBreakdown>;
}

/**
 * Request to prepare agent installation.
 *
 * @remarks
 * Purpose:
 * - Provide payload fields for agent installation preparation.
 *
 * When to use:
 * - Use when initiating agent installation flows.
 *
 * When not to use:
 * - Do not use when unauthenticated or missing agent scopes.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `budget` is a base-unit numeric string.
 *
 * Data/auth references:
 * - `/agents/install/prepare` (oauth-server).
 *
 * Notes:
 * - Sent to `POST /agents/install/prepare`.
 *
 * @property agentServiceId - Agent service UUID.
 * @property installLabel - Optional install label (nullable).
 * @property budget - Policy budget in base units (string).
 * @property selectedTokenPoolId - Optional tenant token pool UUID used as the install default token.
 * @property tokenBudgetsByTokenPoolId - Optional per-token budgets keyed by tokenPoolId (base units).
 * @property tokenBudgetMode - Optional token budgeting mode (`single` or `all`).
 * @property permissions - Deprecated. Client-provided permissions are non-authoritative and ignored by OAuth.
 * @property validityDays - Requested validity window in days (OAuth enforces per-agent min/default/max bounds).
 * @property metadata - Optional metadata blob.
 * @property receipt - Optional IEE (SafeApprove) receipt for `agent_install_prepare_v1` (auto-generated when orchestration is available).
 * @property installQuestions - Optional question schema for client-side validation.
 * @property validateInstallInputs - When true, validates installInputs against installQuestions.
 *
 * @example
 * { "agentServiceId": "svc_123", "budget": "1000000000000000000", "permissions": ["payments:execute"] }
 *
 * @see /agents/install/prepare
 */
export interface PrepareInstallationRequest {
  agentServiceId: string;
  selectedTokenPoolId?: string;
  installLabel?: string;
  budget: string;
  tokenBudgetsByTokenPoolId?: Record<string, string>;
  tokenBudgetMode?: "single" | "all";
  permissions?: string[];
  validityDays?: number;
  installInputs?: Record<string, string | number>;
  installQuestionsVersion?: number | null;
  installQuestions?: AgentInstallQuestion[];
  /** When true, validate installInputs with installQuestions before sending. */
  validateInstallInputs?: boolean;
  metadata?: Record<string, unknown>;
  receipt?: string | null;
}

/**
 * Options for updating installation config inputs.
 *
 * @remarks
 * Purpose:
 * - Provide optional validation inputs for config updates.
 *
 * @property installQuestionsVersion - Pinned question version for optimistic updates.
 * @property receipt - Optional IEE (SafeApprove) receipt.
 * @property installQuestions - Optional question schema for client-side validation.
 * @property existingInputs - Optional prior inputs used for update-mode validation.
 * @property validateInstallInputs - When true, validates installInputs against installQuestions.
 * @property tokenBudgetsByTokenPoolId - Optional per-token budgets keyed by tokenPoolId (base units).
 * @property tokenBudgetMode - Optional token budget mode (`single` or `all`).
 */
export interface UpdateInstallationConfigOptions {
  installQuestionsVersion?: number | null;
  receipt?: string | null;
  installQuestions?: AgentInstallQuestion[];
  existingInputs?: Record<string, string>;
  validateInstallInputs?: boolean;
  tokenBudgetsByTokenPoolId?: Record<string, string> | null;
  tokenBudgetMode?: "single" | "all" | null;
}

/**
 * Response from prepare installation.
 *
 * @remarks
 * Purpose:
 * - Describe the response payload for installation preparation.
 *
 * When to use:
 * - Use after calling agent installation prepare endpoints.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `agentPass` and `account` are 0x-prefixed identifiers.
 *
 * Data/auth references:
 * - `/agents/install/prepare` (oauth-server).
 *
 * Notes:
 * - Returned by `POST /agents/install/prepare`.
 *
 * @property installationId - Installation UUID.
 * @property agentPass - Agent pass identifier.
 * @property account - Account identifier.
 * @property unsignedTransaction - Unsigned transaction payload.
 * @property thirdwebClientId - Thirdweb client id.
 * @property expiresAt - Expiration timestamp (ISO 8601).
 *
 * @example
 * { "installationId": "inst_123", "agentPass": "0x1234...", "account": "0x5678..." }
 *
 * @see /agents/install/prepare
 */
export interface PrepareInstallationResponse {
  installationId: string;
  agentPass: string;
  account: string;
  unsignedTransaction: unknown;
  thirdwebClientId: string;
  expiresAt: string;
}

/**
 * Request to confirm installation after signing.
 *
 * @remarks
 * Purpose:
 * - Provide payload fields for installation confirmation.
 *
 * When to use:
 * - Use after signing the installation transaction.
 *
 * When not to use:
 * - Do not use without a valid transaction hash.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `transactionHash` is a 0x-prefixed 32-byte hex string.
 *
 * Data/auth references:
 * - `/agents/install/confirm` (oauth-server).
 *
 * Notes:
 * - Sent to `POST /agents/install/confirm`.
 *
 * @property installationId - Installation UUID.
 * @property transactionHash - Network transaction hash.
 * @property receipt - Optional IEE (SafeApprove) receipt for receipt-gated confirmation.
 * @property agentServiceId - Agent service id required for IEE (SafeApprove) preflight when no receipt is provided.
 * @property budget - Budget required for IEE (SafeApprove) preflight when no receipt is provided.
 *
 * @example
 * { "installationId": "inst_123", "transactionHash": "0xabc..." }
 *
 * @see /agents/install/confirm
 */
export interface ConfirmInstallationRequest {
  installationId: string;
  transactionHash: string;
  receipt?: string | null;
  agentServiceId?: string;
  budget?: string;
}

/**
 * Response from confirm installation.
 *
 * @remarks
 * Purpose:
 * - Describe the response payload from installation confirmation.
 *
 * When to use:
 * - Use after confirming an installation transaction.
 *
 * When not to use:
 * - Do not construct manually; treat as a response DTO.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `agentPass` is a 0x-prefixed identifier.
 *
 * Data/auth references:
 * - `/agents/install/confirm` (oauth-server).
 *
 * Notes:
 * - Returned by `POST /agents/install/confirm`.
 *
 * @property installationId - Installation UUID.
 * @property agentActorId - Agent actor UUID.
 * @property agentPass - Agent pass identifier.
 * @property status - Installation status.
 *
 * @example
 * { "installationId": "inst_123", "agentActorId": "actor_123", "agentPass": "0x1234...", "status": "active" }
 *
 * @see /agents/install/confirm
 */
export interface ConfirmInstallationResponse {
  installationId: string;
  agentActorId: string;
  agentPass: string;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
}

/**
 * Configuration passed into SDK clients.
 *
 * @remarks
 * Purpose:
 * - Configure OAuth base URLs, client credentials, and fetch behavior.
 *
 * When to use:
 * - Use when constructing OAuthService, API clients, or SDK helpers.
 *
 * When not to use:
 * - Do not embed client secrets in browser contexts.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `baseUrl` must be an OAuth protocol host.
 *
 * Data/auth references:
 * - `/oauth/authorize`, `/oauth/token`, and `/oauth/user` (oauth-server).
 *
 * Security notes:
 * - `clientSecret` is sensitive; keep it server-side.
 */
export interface SDKConfig {
  baseUrl: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string; // legacy name; used for /oauth/user by default
  fetch?: typeof fetch;
  defaultScopes?: Scope[];
  clientId?: string;
  /**
   * Optional client secret for confidential clients (server-side only).
   * Do NOT supply in browser environments.
   */
  clientSecret?: string;
  /**
   * Optional client authentication method for /oauth/token.
   * Defaults to client_secret_post.
   */
  clientAuthMethod?: 'client_secret_post' | 'client_secret_basic';
  /**
   * @internal Override for API base host. For internal/testing use only.
   * Accepts host-only URLs; `/api` or `/api/v{n}` suffixes are normalized away.
   * Headless helpers require explicit apiHost; do not rely on implicit defaults here.
   */
  apiBaseUrl?: string;
}

/**
 * Auth state exposed by the React provider.
 *
 * @remarks
 * Purpose:
 * - Describe the authentication state shared by the React provider.
 *
 * When to use:
 * - Use when inspecting auth state inside sdk-react hooks or UI components.
 *
 * When not to use:
 * - Do not mutate directly; state is managed by SDK providers.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `status` drives state transitions in the React provider.
 *
 * Data/auth references:
 * - Derived from OAuth bootstrap (`/oauth/user`, `/oauth/tenant`) and token storage.
 *
 * Notes:
 * - `accountState` may be null when only `/oauth/user` data is loaded.
 *
 * @property status - Auth state status.
 * @property user - User identity (nullable).
 * @property tokens - Token set (nullable).
 * @property tenant - Tenant configuration (nullable).
 * @property accountState - Account state (nullable).
 * @property error - Error object (nullable).
 *
 * @example
 * { "status": "authenticated", "user": { "id": "user_123", "account": { "name": "account", "kind": "account", "account": "0x..." } } }
 */
export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: UserInfo | null;
  tokens: TokenSet | null;
  tenant: TenantConfig | null;
  accountState: AccountState | null;
  error?: Error;
}

/**
 * Access token verification result for server helpers.
 *
 * @remarks
 * Purpose:
 * - Describe the result of verifying an access token on the server.
 *
 * When to use:
 * - Use when handling server-side session verification or middleware checks.
 *
 * When not to use:
 * - Do not use on the client; verification is server-only.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - `issuedAt` is epoch seconds.
 *
 * Data/auth references:
 * - Derived from `/oauth/user` and `/oauth/tenant` during verification.
 *
 * Notes:
 * - Returned by server-side token verification utilities.
 *
 * @property user - User identity payload.
 * @property tenant - Tenant configuration payload.
 * @property accountState - Account state payload (nullable).
 * @property tokens - Token set.
 * @property issuedAt - Token issued-at epoch seconds.
 * @property fromCache - Whether the result was cached (nullable).
 *
 * @example
 * { "issuedAt": 1700000000, "fromCache": true }
 */
export interface SessionVerificationResult {
  user: UserInfo;
  tenant: TenantConfig;
  accountState: AccountState | null;
  tokens: TokenSet;
  issuedAt: number;
  fromCache?: boolean;
}
