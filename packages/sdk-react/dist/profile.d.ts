import { type UpdateProfileInput, type UserInfo } from "@xkova/sdk-core";
/**
 * Update the authenticated user's profile.
 *
 * @remarks
 * Purpose:
 * - Provide a hook for updating profile fields and reloading bootstrap state.
 *
 * When to use:
 * - Use when building profile editing UI for authenticated users.
 *
 * When not to use:
 * - Do not use when unauthenticated; the hook throws if called without auth.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Returns `{ updateProfile, updateAvatar, isLoading, error }`.
 *
 * Errors/failure modes:
 * - updateProfile throws when unauthenticated, IEE (SafeApprove) approval fails/cancels, or when the API request fails.
 *
 * Side effects:
 * - Launches the IEE (SafeApprove) approval UI for `profile_update_v1`.
 * - Issues `PUT /oauth/user` (with IEE (SafeApprove) receipt) and refreshes bootstrap state.
 * - Avatar uploads use signed upload URLs and then update `avatar_path` via `PUT /oauth/user`.
 *
 * Invariants/assumptions:
 * - Requires an authenticated SDK session.
 * - Requires an IEE (SafeApprove) approval for `profile_update_v1`.
 *
 * Data/auth references:
 * - Uses oauth-server `/oauth/user` endpoint.
 */
export declare const useUserProfile: () => {
    updateProfile: (input: UpdateProfileInput) => Promise<UserInfo>;
    updateAvatar: (file: Blob | ArrayBuffer | Uint8Array | FormData, options?: {
        contentType?: string;
        fetch?: typeof fetch;
    }) => Promise<UserInfo>;
    isLoading: boolean;
    error: Error | null;
};
