export interface HostedHandleChangeOptions {
    /**
     * Optional return target after the hosted flow completes.
     */
    returnTo?: string;
    /**
     * Optional error handler for launch failures.
     */
    onError?: (error: Error) => void;
}
/**
 * Hosted handle-change launcher.
 *
 * @remarks
 * Purpose:
 * - Provide a simple client-side entry point to the hosted handle-change page.
 *
 * When to use:
 * - Use when you want to send users to the XKOVA-hosted handle-change UI.
 *
 * When not to use:
 * - Do not use on the server; this hook triggers browser navigation.
 *
 * Parameters:
 * - `options.returnTo`: Optional return URL (passed as `return_to`).
 * - `options.onError`: Optional error callback.
 *
 * Return semantics:
 * - Returns `{ url, launch, isAvailable }`.
 *
 * Errors/failure modes:
 * - `launch` throws when authDomain is missing or during SSR (unless onError handles it).
 *
 * Side effects:
 * - Navigates the browser to the hosted handle-change page.
 *
 * Invariants/assumptions:
 * - Requires tenant authDomain from bootstrap.
 */
export declare const useHostedHandleChange: (options?: HostedHandleChangeOptions) => {
    url: string | null;
    launch: (override?: {
        returnTo?: string;
    }) => void;
    isAvailable: boolean;
};
