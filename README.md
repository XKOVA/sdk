# XKOVA Public SDK

XKOVA public SDK workspace containing:

- `@xkova/sdk`
- `@xkova/sdk-core`
- `@xkova/sdk-react`
- `@xkova/sdk-react-ui`
- `@xkova/sdk-browser`
- `@xkova/sdk-agent`

## Canonical Quickstart (external developers)

### 1. Platform prerequisites

The SDK requires XKOVA platform configuration before app code can authenticate.

- Create an OAuth client for your web app (`application_type=web`).
- Configure redirect URI and allowed origin for your app host.
- For agent runtimes, create a service and service credential (`SERVICE_ID`, `SERVICE_CREDENTIAL`), and configure an explicit runtime target:
  - Preferred: `XKOVA_CORE_URL`
  - Shorthand: `XKOVA_ENV` (`local`/`dev`/`staging`/`production`, required when used)

### 2. Choose a starter

- Web/BFF starter: XKOVA Playground (external starter repository)
- Agent starter: Simple Subscription Agent (external starter repository)

### 3. Install

```bash
pnpm add @xkova/sdk
# or npm install @xkova/sdk
```

### 4. Mount provider + first authenticated read

```tsx
import { XKOVAProvider, useAuth } from "@xkova/sdk/react";

function AuthStatus() {
  const { status, user } = useAuth();
  return <pre>{JSON.stringify({ status, email: user?.email ?? null }, null, 2)}</pre>;
}

export default function App() {
  return (
    <XKOVAProvider
      baseUrl={process.env.NEXT_PUBLIC_XKOVA_CORE_URL!}
      clientId={process.env.NEXT_PUBLIC_XKOVA_CLIENT_ID!}
      appLoginUrl="/auth/login"
      appTokenEndpoint="/api/token"
      appSessionEndpoint="/api/auth/session"
      appLogoutEndpoint="/api/logout"
    >
      <AuthStatus />
    </XKOVAProvider>
  );
}
```

## Package docs

- Umbrella entry points and exports: [@xkova/sdk README](./packages/sdk/README.md)
- Headless services and OAuth helpers: [@xkova/sdk-core README](./packages/sdk-core/README.md)
- Agent primitives: [@xkova/sdk-agent README](./packages/sdk-agent/README.md)

## Workspace development

Run from repository root:

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
```

Ordered build:

```bash
pnpm -r --sort build
```

Explicit build order:

```bash
pnpm --filter @xkova/sdk-core build
pnpm --filter @xkova/sdk-react build
pnpm --filter @xkova/sdk-react-ui build
pnpm --filter @xkova/sdk build
pnpm --filter @xkova/sdk-agent build
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
