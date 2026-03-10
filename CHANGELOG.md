# Changelog

All notable changes to the XKOVA SDK packages will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/). While in `0.x`, breaking changes may occur in minor releases.

## [0.1.0] - 2026-01-30

### Added
- `@xkova/sdk-core` - OAuth, API client, IEE orchestration, typed errors, services (account, contacts, transfers, payments, agents, sessions, marketplace)
- `@xkova/sdk-react` - React provider, auth hooks, data hooks with automatic IEE receipt handling
- `@xkova/sdk-react-ui` - Pre-built UI components (cards, dialogs, identity)
- `@xkova/sdk-browser` - Vanilla browser IEE receipt provider (iframe/popup)
- `@xkova/sdk` - Umbrella package with subpath exports

### Notes
- ESM-only. Requires Node >= 20.
- All packages at `0.x` - API may change before `1.0.0`.
