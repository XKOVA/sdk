# SDK Release Workflow

This file describes the release flow for this standalone SDK repository.

## Prerequisites

- npm scope access for `@xkova`
- Repository Actions enabled
- Repository secret: `NPM_TOKEN`

The release workflow requires GitHub Actions permissions to write:

- `contents`
- `pull-requests`

## Day-To-Day Developer Flow

1. Make SDK code changes in a feature branch.
2. Add a changeset:

```bash
pnpm changeset
```

3. Choose bump type using `VERSIONING.md` rules.
4. Commit code + `.changeset/*.md`.
5. Open PR and merge to `main` after review and CI pass.

## When To Add A Changeset

Add a changeset for every SDK change that affects consumers:

- API surface changes
- behavior changes
- dependency/peer/runtime requirement changes
- bug fixes visible to consumers

Skip changeset only for changes that do not affect published packages (for example CI-only edits).

## Version Packages PR Flow

On push to `main`, `.github/workflows/sdk-release.yml` runs Changesets automation:

- If pending changesets exist, it opens or updates a PR titled `chore: version packages`.
- That PR includes:
  - package version updates
  - changelog updates
  - consumed/removed changeset files

## Publish Flow

When the Version Packages PR is merged:

1. Release workflow runs on `main`.
2. It installs dependencies.
3. It runs workspace build.
4. It runs `changeset publish` through the root `release` script.
5. Packages publish to npm with `publishConfig.access=public`.

## Required Secrets And Environment

- `NPM_TOKEN`: npm automation token with publish rights to `@xkova/*`.
- `GITHUB_TOKEN`: provided automatically by Actions; used to create/update PRs.

## Dry-Run Validation (No Publish)

Run from repository root:

```bash
pnpm install
pnpm build
pnpm test
pnpm changeset status
```

Optional publish simulation:

```bash
pnpm changeset version
git diff -- packages/*/package.json CHANGELOG.md
git checkout -- packages/*/package.json CHANGELOG.md
```
