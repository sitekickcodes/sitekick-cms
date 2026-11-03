/**
 * TypeScript 6 stopped including `node_modules/@types/*` automatically, so
 * `bun:test` (used by `*.test.ts` under src) is pulled in here from
 * `@types/bun` (devDependencies). Same effect as `"types": ["bun"]` in
 * tsconfig, kept in src so the package config stays minimal.
 */
/// <reference types="bun" />
