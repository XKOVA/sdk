# @xkova/sdk-react-ui

Optional UI components (cards, dialogs, primitives) for apps using `@xkova/sdk-react`.

## Install

```bash
pnpm add @xkova/sdk-react-ui
# or npm install @xkova/sdk-react-ui
```

## Requirements

- React 16.8+.
- Import `@xkova/sdk-react-ui/styles.css` once in your app entrypoint.
- Wrap SDK UI with `XKOVATheme` (or add `className="xkova-theme"` on a parent).
- SDK styles are precompiled and scoped under `.xkova-theme`; consumer apps should not add Tailwind `@source` entries for SDK internals.
- ESM-only package.

## Usage

```tsx
import "@xkova/sdk-react-ui/styles.css";
import { SignedIn, SignedOut, Human, XKOVATheme } from "@xkova/sdk-react-ui";

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <XKOVATheme mode="light">
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Human mode="signin" label="Sign in to XKOVA" />
      </SignedOut>
    </XKOVATheme>
  );
}
```

`@xkova/sdk-react-ui` requires `@xkova/sdk-react` to provide context via `XKOVAProvider`.

## Error Handling

Components surface errors from the underlying `@xkova/sdk-react` hooks and `@xkova/sdk-core` error types:

- `SDKError` — base class with `.code` for programmatic handling
- `NetworkError`, `TimeoutError`, `UnauthorizedError` — transport-level
- `IeeError` — IEE (SafeApprove) receipt failures (`IEE_REQUIRED`, `IEE_CANCELLED`, `IEE_FAILED`)

Use `getUserFriendlyErrorMessage()` to convert SDK errors into user-safe strings.

## IEE (SafeApprove) (Interactive Execution Environment)

UI components that perform write operations rely on the `@xkova/sdk-react` hooks, which automatically handle IEE (SafeApprove) when `XKOVAProvider` is configured with a receipt provider (typically `createBrowserIeeReceiptProvider` from `@xkova/sdk-browser`).

## Export Catalog

### Cards + surfaces
- `AccountCard`, `AccountCardProps` — account summary card.
- `TenantCard` — tenant summary card.
- `BalanceCard`, `BalanceCardProps` — balances card.
- `TransfersCard`, `TransfersCardProps` — transfers card.
- `TransferActivityCard`, `TransferActivityCardProps` — transfer activity feed.
- `SendPaymentCard`, `SendPaymentCardProps` — send payment form.
- `TransactionsCard`, `TransactionsCardProps` — transaction history card.
- `PaymentHistoryCard`, `PaymentHistoryCardProps` — payment history card.
- `RequestPaymentCard`, `RequestPaymentCardProps` — create payment request card.
- `RequestHistoryCard` — payment request history card.
- `SessionManagerCard`, `SessionManagerCardProps` — session management card.
- `ContactsCard`, `ContactsCardProps` — contacts management card.
- `HumanIdentity`, `HumanIdentityProps` — human identity panel.

### Agent UI
- `AgentMarketplaceCard`, `AgentMarketplaceCardProps` — marketplace agent card.
- `InstalledAgentsCard`, `InstalledAgentsCardProps` — installed agents list.
- `AgentInstallFlow`, `AgentInstallFlowProps` — agent install flow.
- `Agent`, `AgentProps` — single agent tile.

### Auth gating
- `Human`, `HumanProps` — hosted sign-in/sign-up UI.
- `SignedIn` — render children when authenticated.
- `SignedOut` — render children when unauthenticated.

### UI primitives
- `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` — card building blocks.
- `CardHeaderRow`, `CardHeaderRowProps` — card header row layout.
- `CardSectionLabel`, `CardSectionLabelProps` — card section label layout.
- `CardEmptyState`, `CardEmptyStateProps` — empty state layout.
- `CardValue`, `CardValueProps` — value emphasis layout.
- `Button`, `ButtonProps`, `buttonVariants` — button component + variants.
- `Badge`, `BadgeProps`, `badgeVariants` — badge component + variants.
- `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` — table primitives.
- `Skeleton` — loading skeleton.
- `Input` — styled input component.
- `Select`, `SelectProps` — select input component.
- `SelectMenu`, `SelectMenuGroup`, `SelectMenuValue`, `SelectMenuTrigger`, `SelectMenuContent`, `SelectMenuLabel`, `SelectMenuItem`, `SelectMenuSeparator` — Radix select menu primitives.
- `Label` — form label component.
- `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — dialog primitives.
- `AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` — alert dialog primitives.
- `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` — tooltip primitives.
- `XKOVATheme`, `XKOVAThemeMode` — theme wrapper + theme mode type.
- `BalanceText`, `BalanceTextProps` — formatted token balance text.
- `NetworkText`, `NetworkTextProps` — network label with optional logo.

### Utilities + toasts
- `cn` — className merge helper.
- `getFocusableElements` — list focusable elements in a container.
- `trapFocusWithin` — trap Tab focus within a container.
- `UIErrorTelemetryEvent` — sanitized UI error telemetry payload.
- `setUIErrorTelemetryHandler` — register UI error telemetry handler.
- `createUIErrorTelemetryAdapter` — bridge UI errors into SDK telemetry.
- `getUserFriendlyErrorMessage` — convert SDK errors into user-safe strings.
- `Toaster` — Sonner toast container component.

### Subpath exports
- `@xkova/sdk-react-ui/utils` — utility helpers (`cn`, `getFocusableElements`, `trapFocusWithin`).
- `@xkova/sdk-react-ui/styles.css` — Tailwind/shadcn styles for SDK UI.
