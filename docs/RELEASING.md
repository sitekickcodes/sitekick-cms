# Releasing

The four published packages, `@sitekick/cms`, `@sitekick/blocks`, `@sitekick/agents` and `create-sitekick-cms`, always release together, at the same version. New sites from the CLI depend on that version.

## Day to day

1. In a PR that changes a published package, add a changeset by running `bunx changeset`. Pick the packages and the size of the change (patch, minor or major), and write one line for the changelog.
2. Merge the PR. The Release workflow opens a **Version packages** PR, or updates it if it's already open. That PR bumps every package to the next version and writes the changelogs.
3. Merge the Version packages PR. The workflow then packs the compiled packages with `scripts/pack.ts` and publishes each version npm doesn't have yet (`scripts/release.ts`), with provenance.

We're in beta prerelease mode (`.changeset/pre.json`), so versions go `0.1.0-beta.0`, `0.1.0-beta.1` and so on, published under the `beta` tag. Leave beta with `bunx changeset pre exit` in a PR. The next Version packages PR is then the stable release, published as `latest`.

To see what would be published without publishing anything, run `bun run release -- --dry-run`. It needs no npm login.

## One-time setup (not done yet)

1. **Claim the `@sitekick` scope on npm.** Create the `sitekick` organisation at npmjs.com, because packages under `@sitekick/` can only be published by its members. `create-sitekick-cms` is unscoped; check that the name is still free.
2. **Add an automation token.** Create a granular access token at npmjs.com with publish rights to the `@sitekick` packages and `create-sitekick-cms`. Save it as the repository secret `NPM_TOKEN`: Settings › Secrets and variables › Actions. Until that secret exists, the workflow says "no npm login" and publishes nothing.
3. **Let Actions open PRs:** Settings › Actions › General › Workflow permissions › "Allow GitHub Actions to create and approve pull requests".
4. **First publish.** The current version (`0.1.0-beta.0`) has never been published, so the first push to main after steps 1 and 2 publishes it. No changeset is needed.

After the first publish, npm's trusted publishing can replace the token. Link each package to this repository's Release workflow on npmjs.com, then delete `NPM_TOKEN`.
