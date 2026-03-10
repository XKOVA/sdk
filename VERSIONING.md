# SDK Versioning Policy

This SDK workspace uses lockstep versioning for all public SDK packages:

- `@xkova/sdk`
- `@xkova/sdk-core`
- `@xkova/sdk-react`
- `@xkova/sdk-react-ui`
- `@xkova/sdk-browser`
- `@xkova/sdk-agent`

## Lockstep Rules

- All listed packages always publish with the same version.
- A version bump for one package bumps all six.
- Packages with the same version are expected to work together.

## 0.x Bump Rules

While SDK packages remain on `0.x`:

- Breaking changes -> **minor** bump
- Backwards-compatible features -> **minor** bump
- Fixes -> **patch** bump

## What Is Breaking

Treat any incompatible change to any public SDK package as breaking, including:

- Public exports added/removed/renamed in a non-compatible way
- Function signatures, required params, or return value contract changes
- New required configuration or removed config behavior
- Runtime/platform support changes (for example Node version changes)
- Peer dependency expectation changes
- Default behavior changes that alter existing integration outcomes

## Compatibility Expectations

- SDK consumers should keep all `@xkova/*` SDK packages on the same published version.
- Mixed-version installs are not part of the support target.

## Deprecation Policy

- Prefer deprecation before removal when practical, even during `0.x`.
- Document deprecations in package changelog entries with migration guidance.

## Future Criteria For Moving Away From Lockstep

Lockstep can be reconsidered when all are true:

- Package APIs are stable and independently versioned release cadence is justified.
- Compatibility matrix maintenance is automated and documented.
- Cross-package integration test coverage is strong enough for independent bumps.
- Operational overhead of lockstep exceeds its safety benefits.
