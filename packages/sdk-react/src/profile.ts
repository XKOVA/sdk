import { useCallback, useMemo, useState } from "react";
import { UserProfileService, type UpdateProfileInput, type UserInfo } from "@xkova/sdk-core";
import { useSDK } from "./provider.js";

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
export const useUserProfile = () => {
  const { state, authClient, reloadBootstrap, iee } = useSDK();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const service = useMemo(
    () => new UserProfileService({ client: authClient, iee }),
    [authClient, iee],
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput): Promise<UserInfo> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      setIsLoading(true);
      setError(null);
      try {
        await service.updateProfile(input);

        // Refresh local bootstrap snapshot so useAuth() reflects changes immediately.
        const payload = await reloadBootstrap();
        if (!payload) {
          throw new Error("Failed to refresh user profile");
        }
        return payload.user;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service, reloadBootstrap, state.status],
  );

  const updateAvatar = useCallback(
    async (
      file: Blob | ArrayBuffer | Uint8Array | FormData,
      options?: { contentType?: string; fetch?: typeof fetch },
    ): Promise<UserInfo> => {
      if (state.status !== "authenticated") {
        throw new Error("User is not authenticated");
      }
      setIsLoading(true);
      setError(null);
      try {
        const userId = state.user?.id;
        const avatarPath = userId ? `profiles/${userId}/avatar` : undefined;
        await service.uploadAvatar(file, {
          ...options,
          avatarPath,
        });

        const payload = await reloadBootstrap();
        if (!payload) {
          throw new Error("Failed to refresh user profile");
        }
        return payload.user;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service, reloadBootstrap, state.status],
  );

  return { updateProfile, updateAvatar, isLoading, error };
};
