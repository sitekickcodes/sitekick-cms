# Changesets

A changeset is a note about a change that should go in the next release. Add one with any PR that changes a published package:

```sh
bunx changeset
```

Pick the packages you changed and the size of the change, then write one line for the changelog. You don't need to pick them all: `@sitekick/cms`, `@sitekick/blocks`, `@sitekick/agents` and `create-sitekick-cms` always release together, at the same version.

When changesets land on `main`, the Release workflow opens a "Version packages" PR. Merging that PR publishes the new version to npm. See docs/RELEASING.md.
