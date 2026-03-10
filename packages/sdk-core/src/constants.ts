/**
 * SDK Constants
 *
 * API_BASE_URL is hardcoded for production. For internal development builds,
 * this value is replaced at build time via bundler define/replace plugins.
 *
 * DO NOT use runtime environment variables here - they don't work reliably
 * in browser environments.
 */

/**
 * Production API base URL used by default SDK clients.
 *
 * @remarks
 * Purpose:
 * - Provide a stable default origin for apps/api requests when no override is supplied.
 *
 * When to use:
 * - Use as the default base URL in SDK integrations targeting the hosted XKOVA API.
 *
 * When not to use:
 * - Do not use for self-hosted, on-prem, or staged environments; pass an explicit base URL instead.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Constant string value for the production API origin.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Value may be replaced at build time for internal dev/staging builds.
 *
 * Data/auth references:
 * - Base origin for apps/api REST requests.
 */
export const API_BASE_URL = "https://api.xkova.com";

/**
 * Default API version path segment for apps/api routes.
 *
 * @remarks
 * Purpose:
 * - Provide the canonical API version string used in SDK URL construction.
 *
 * When to use:
 * - Use when constructing apps/api paths that require a version segment.
 *
 * When not to use:
 * - Do not hardcode this value into URLs that already include the version path.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Constant string value for the API version (e.g., "v1").
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Matches the version of apps/api routes surfaced by this SDK.
 *
 * Data/auth references:
 * - Applies to apps/api endpoints accessed via SDK clients.
 */
export const API_VERSION = "v1";


