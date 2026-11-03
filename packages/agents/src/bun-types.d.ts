/**
 * TypeScript 6 stopped including `node_modules/@types/*` automatically, so
 * `bun:test` (used by every `*.test.ts` under src) is pulled in here from
 * `@types/bun` (devDependencies). Same arrangement as packages/cms.
 */
/// <reference types="bun" />
