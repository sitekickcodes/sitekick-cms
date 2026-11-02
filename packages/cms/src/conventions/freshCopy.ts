/**
 * A copy of a config tree that buildConfig can mutate freely: plain objects
 * and arrays are copied (shared references and cycles stay shared within the
 * copy), everything else (functions, class instances like editor adapters,
 * Dates, RegExps) is kept by reference.
 *
 * Why: buildConfig mutates what it's given. Plugins push fields, hooks and
 * admin components into collection configs (multi-tenant unshifts `tenant`)
 * and Payload's sanitizer rewrites fields in place. In a cold start that's
 * harmless, but Turbopack server fast refresh (turned on in
 * next.config.ts) re-runs payload.config.ts after an edit WITHOUT
 * re-running the unchanged collection modules, so their already-mutated
 * exports would be built a second time: "DuplicateFieldName: … 'tenant'",
 * and Payload's HMR reload then leaves getPayload() hanging for every page.
 * Copying first keeps the module exports pristine, so every build starts
 * from the same input a cold start does.
 */
export function freshCopy<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value !== "object" || value === null) return value;
  const cached = seen.get(value);
  if (cached) return cached as T;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(freshCopy(item, seen));
    return copy as T;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const copy: Record<PropertyKey, unknown> = Object.create(proto);
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    copy[key] = freshCopy((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return copy as T;
}
