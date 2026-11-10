# Releasing

The four published packages, `@sitekick/cms`, `@sitekick/blocks`, `@sitekick/agents` and `create-sitekick-cms`, always release together, at the same version. New sites from the CLI depend on that version.

## Day to day

1. In a PR that changes a published package, add a changeset by running `bunx changeset`. Pick the packages and the size of the change (patch, minor or major), and write one line for the changelog.
2. Merge the PR. The Release workflow opens a **Version packages** PR, or updates it if it's already open. That PR bumps every package to the next version and writes the changelogs.
3. Merge the Version packages PR. The workflow then packs the compiled packages with `scripts/pack.ts` and publishes each version npm doesn't have yet (`scripts/release.ts`), with provenance.

We're in beta prerelease mode (`.changeset/pre.json`), so versions go `0.1.0-beta.0`, `0.1.0-beta.1` and so on, published under the `beta` tag. Leave beta with `bunx changeset pre exit` in a PR. The next Version packages PR is then the stable release, published as `latest`.

To see what would be published without publishing anything, run `bun run release -- --dry-run`. It needs no npm login.

## Setup

- **npm:** the `sitekick` org exists (owner: johngilesyoder). `0.1.0-beta.0` of all four packages was published on 2026-11-09, with provenance.
- **Trusted publishing:** the Release workflow publishes with npm trusted publishing (OIDC), so there's no npm token anywhere. Each package's npmjs.com Settings › Trusted publishing names GitHub Actions, `sitekickcodes/sitekick-cms`, workflow `release.yml`. Renaming or moving that workflow file breaks publishing until those settings are updated to match.
- **Still to do:** **Let Actions open PRs** (org-wide): github.com/organizations/sitekickcodes/settings/actions › "Allow GitHub Actions to create and approve pull requests". Without it, the Version packages PR can't be opened.
