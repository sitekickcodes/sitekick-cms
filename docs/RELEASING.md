# Releasing

The four published packages, `@sitekick/cms`, `@sitekick/blocks`, `@sitekick/agents` and `create-sitekick-cms`, always release together, at the same version. New sites from the CLI depend on that version.

## Day to day

1. In a PR that changes a published package, add a changeset by running `bunx changeset`. Pick the packages and the size of the change (patch, minor or major), and write one line for the changelog.
2. Merge the PR. The Release workflow opens a **Version packages** PR, or updates it if it's already open. That PR bumps every package to the next version and writes the changelogs.
3. Merge the Version packages PR. The workflow then packs the compiled packages with `scripts/pack.ts` and publishes each version npm doesn't have yet (`scripts/release.ts`), with provenance.

Releases are stable and go out under the `latest` tag. The betas (`0.1.0-beta.0` and `beta.1`) ended with `0.1.0` on 2026-11-17. For a future prerelease, enter pre mode with `bunx changeset pre enter beta` in a PR; versions then go `x.y.z-beta.0` and so on under the `beta` tag, and `bunx changeset pre exit` leaves it. A prerelease version is published under its tag automatically (`scripts/release.ts`).

Until Actions may open PRs (see Setup), the Version packages step is done by hand: run `bun run version` in the PR that adds the changeset, and merging it publishes.

To see what would be published without publishing anything, run `bun run release -- --dry-run`. It needs no npm login.

## Setup

- **npm:** the `sitekick` org exists (owner: johngilesyoder). `0.1.0-beta.0` of all four packages was published on 2026-11-09, `0.1.0-beta.1` (trusted publishing) on 2026-11-10, and `0.1.0`, the first stable release, from the release PR of 2026-11-17.
- **Trusted publishing:** the Release workflow publishes with npm trusted publishing (OIDC), so there's no npm token anywhere. Each package's npmjs.com Settings › Trusted publishing names GitHub Actions, `sitekickcodes/sitekick-cms`, workflow `release.yml`. Renaming or moving that workflow file breaks publishing until those settings are updated to match.
- **Still to do:** **Let Actions open PRs** (org-wide): github.com/organizations/sitekickcodes/settings/actions › "Allow GitHub Actions to create and approve pull requests". Without it, the Version packages PR can't be opened.
