"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export function HumanIdentity({ onToast }) {
    const { user } = useAuth();
    const { updateProfile, isLoading: updatingProfile } = useUserProfile();
    const [editOpen, setEditOpen] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    if (!user)
        return null;
    const notify = useCallback((type, message) => {
        notifyToast(type, message, { onToast });
    }, [onToast]);
    const returnTo = useMemo(() => {
        if (typeof window === "undefined")
            return undefined;
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
        if (!editOpen)
            return;
        setFirstName(user.firstName ?? "");
        setLastName(user.lastName ?? "");
    }, [editOpen, user.firstName, user.lastName]);
    const handleSave = useCallback(async () => {
        const nextFirst = firstName.trim();
        const nextLast = lastName.trim();
        const input = {};
        if (nextFirst !== (user.firstName ?? "")) {
            if (nextFirst)
                input.firstName = nextFirst;
        }
        if (nextLast !== (user.lastName ?? "")) {
            if (nextLast)
                input.lastName = nextLast;
        }
        if (!input.firstName && !input.lastName) {
            setEditOpen(false);
            return;
        }
        try {
            await updateProfile(input);
            notify("success", "Saved");
            setEditOpen(false);
        }
        catch (err) {
            notify("error", err.message ?? "Failed to update profile");
        }
    }, [firstName, lastName, updateProfile, user.firstName, user.lastName, notify]);
    const handleLaunchEmailChange = useCallback(() => {
        launchEmailChange();
    }, [launchEmailChange]);
    const verifiedLabel = useMemo(() => {
        return user.emailVerified ? "Verified" : "Not verified";
    }, [user.emailVerified]);
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(User, { className: "size-5" }), "Profile"] }), description: _jsx(CardDescription, { children: "Your account information." }), actions: _jsx(Button, { variant: "outline", size: "sm", onClick: () => setEditOpen(true), children: "Edit" }) }) }), _jsxs(CardContent, { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-12 rounded-full bg-primary/10 flex items-center justify-center", children: _jsx(User, { className: "size-6 text-primary" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium", children: name }), _jsx("p", { className: "text-sm text-muted-foreground", children: user.email })] })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: "Email verified" }), _jsxs(Badge, { variant: user.emailVerified ? "success" : "secondary", className: "gap-1", children: [user.emailVerified ? _jsx(Check, { className: "size-4" }) : _jsx(X, { className: "size-4" }), verifiedLabel] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { children: [_jsx(CardSectionLabel, { className: "normal-case tracking-normal text-xs", children: "First name" }), _jsx("div", { className: "font-medium", children: user.firstName ?? "-" })] }), _jsxs("div", { children: [_jsx(CardSectionLabel, { className: "normal-case tracking-normal text-xs", children: "Last name" }), _jsx("div", { className: "font-medium", children: user.lastName ?? "-" })] })] }), user.handle && (_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: "Handle: " }), _jsxs("span", { className: "font-mono", children: ["@", user.handle] })] })), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Badge, { variant: user.completeProfile ? "success" : "warn", children: user.completeProfile ? "Profile Complete" : "Profile Incomplete" }) }), _jsx(Dialog, { open: editOpen, onOpenChange: setEditOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogTitle, { children: "Edit profile" }), _jsxs("div", { className: "space-y-4 mt-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "first-name", children: "First name" }), _jsx(Input, { id: "first-name", value: firstName, onChange: (e) => setFirstName(e.target.value), placeholder: "First name", disabled: updatingProfile })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "last-name", children: "Last name" }), _jsx(Input, { id: "last-name", value: lastName, onChange: (e) => setLastName(e.target.value), placeholder: "Last name", disabled: updatingProfile })] }), _jsxs("div", { className: "border-t pt-4 space-y-3", children: [_jsxs("div", { className: "flex items-start gap-2 text-sm", children: [_jsx(AlertCircle, { className: "size-4 mt-0.5 text-muted-foreground" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: "Change email" }), _jsx("div", { className: "text-muted-foreground", children: "We'll open a secure hosted flow to verify your current email and your new email." })] })] }), _jsx(Button, { type: "button", variant: "secondary", onClick: handleLaunchEmailChange, disabled: !emailChangeAvailable, children: "Open email change" }), !emailChangeAvailable && (_jsx("div", { className: "text-xs text-muted-foreground", children: "Tenant auth domain is not configured for hosted email change." }))] }), _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setEditOpen(false), disabled: updatingProfile, children: "Cancel" }), _jsx(Button, { onClick: handleSave, disabled: updatingProfile, children: updatingProfile ? "Saving..." : "Save" })] })] })] }) })] })] }));
}
