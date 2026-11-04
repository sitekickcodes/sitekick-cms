/** Client-safe: whether account email is delivered, as recorded by emailPlugin in the client config. */
export function emailSendsFromConfig(config: unknown): boolean {
  const custom = (config as { admin?: { custom?: { sitekick?: { emailSends?: boolean } } } } | undefined)?.admin?.custom
  return custom?.sitekick?.emailSends !== false
}
