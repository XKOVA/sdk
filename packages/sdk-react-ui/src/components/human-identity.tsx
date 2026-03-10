"use client";

import { useAuth, useHostedEmailChange, useUserProfile } from "@xkova/sdk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { User, Check, X, AlertCircle } from "lucide-react";
import { notify as notifyToast } from "../toast-utils.js";

import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardHeaderRow, CardSectionLabel } from "./ui/card-layout.js";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";

/**
 * Props for {@link HumanIdentity}.
 *
 * @remarks
 * Purpose:
 * - Configure toast handling for the profile card.
 *
 * When to use:
 * - Use when providing a custom toast renderer.
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
 * - Toast handler should be fast and non-throwing.
 *
 * Data/auth references:
 * - Used by a component that calls sdk-react profile hooks.
 */
export interface HumanIdentityProps {
  /**
   * Optional toast/notification hook.
   * The playground passes `sonner` here; SDK UI stays dependency-free.
   */
  onToast?: (type: "success" | "error" | "info", message: string) => void;
}

/**
 * User profile card with hosted email change launch.
 *
 * @remarks
 * Purpose:
 * - Display basic user profile data and enable name/email updates.
 *
 * When to use:
 * - Use when providing an account/profile settings screen.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - `props`: HumanIdentityProps. Nullable: yes.
 *
 * Return semantics:
 * - Returns a React element or null when user is missing.
 *
 * Errors/failure modes:
 * - Surfaces errors via toast messages.
 *
 * Side effects:
 * - Issues oauth-server requests for profile updates (IEE (SafeApprove)-gated).
 * - Launches the hosted email-change UI on the tenant auth domain.
 *
 * Invariants/assumptions:
 * - Requires an authenticated user to render.
 *
 * Data/auth references:
 * - Uses `/oauth/user` via sdk-react hooks and `/email-change` hosted UI.
 *
 * Runtime constraints:
 * - Client component (uses hooks).
 */
export function HumanIdentity({ onToast }: HumanIdentityProps) {
  const { user } = useAuth();
  const { updateProfile, isLoading: updatingProfile } = useUserProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  if (!user) return null;

  const notify = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      notifyToast(type, message, { onToast });
    },
    [onToast],
  );

  const returnTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return window.location.href;
  }, []);

  const { launch: launchEmailChange, isAvailable: emailChangeAvailable } = useHostedEmailChange({
    returnTo,
    onError: (err) => {
      notify("error", err?.message ?? "Failed to open email change");
    },
  });

  const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  useEffect(() => {
    if (!editOpen) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
  }, [editOpen, user.firstName, user.lastName]);

  const handleSave = useCallback(async () => {
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();

    const input: any = {};
    if (nextFirst !== (user.firstName ?? "")) {
      if (nextFirst) input.firstName = nextFirst;
    }
    if (nextLast !== (user.lastName ?? "")) {
      if (nextLast) input.lastName = nextLast;
    }

    if (!input.firstName && !input.lastName) {
      setEditOpen(false);
      return;
    }

    try {
      await updateProfile(input);
      notify("success", "Saved");
      setEditOpen(false);
    } catch (err: any) {
      notify("error", err.message ?? "Failed to update profile");
    }
  }, [firstName, lastName, updateProfile, user.firstName, user.lastName, notify]);

  const handleLaunchEmailChange = useCallback(() => {
    launchEmailChange();
  }, [launchEmailChange]);

  const verifiedLabel = useMemo(() => {
    return user.emailVerified ? "Verified" : "Not verified";
  }, [user.emailVerified]);

  return (
    <Card>
      <CardHeader>
        <CardHeaderRow
          title={
        <CardTitle className="flex items-center gap-2">
          <User className="size-5" />
          Profile
        </CardTitle>
          }
          description={<CardDescription>Your account information.</CardDescription>}
          actions={
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="size-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Email verified</span>
          <Badge variant={user.emailVerified ? "success" : "secondary"} className="gap-1">
            {user.emailVerified ? <Check className="size-4" /> : <X className="size-4" />}
            {verifiedLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <CardSectionLabel className="normal-case tracking-normal text-xs">First name</CardSectionLabel>
            <div className="font-medium">{user.firstName ?? "-"}</div>
          </div>
          <div>
            <CardSectionLabel className="normal-case tracking-normal text-xs">Last name</CardSectionLabel>
            <div className="font-medium">{user.lastName ?? "-"}</div>
          </div>
        </div>

        {user.handle && (
          <div className="text-sm">
            <span className="text-muted-foreground">Handle: </span>
            <span className="font-mono">@{user.handle}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge variant={user.completeProfile ? "success" : "warn"}>
            {user.completeProfile ? "Profile Complete" : "Profile Incomplete"}
          </Badge>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Edit profile</DialogTitle>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName((e.target as HTMLInputElement).value)}
                  placeholder="First name"
                  disabled={updatingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName((e.target as HTMLInputElement).value)}
                  placeholder="Last name"
                  disabled={updatingProfile}
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="size-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Change email</div>
                    <div className="text-muted-foreground">
                      We'll open a secure hosted flow to verify your current email and your new email.
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLaunchEmailChange}
                  disabled={!emailChangeAvailable}
                >
                  Open email change
                </Button>
                {!emailChangeAvailable && (
                  <div className="text-xs text-muted-foreground">
                    Tenant auth domain is not configured for hosted email change.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updatingProfile}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updatingProfile}>
                  {updatingProfile ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
