import type { Runner } from '../runner'

/**
 * The eve adapter, as a stub. eve 1.0.0-rc.2 is a filesystem-first runtime:
 * an agent is an `agent/` directory (agent.ts with defineAgent, tools/*.ts
 * with defineTool, hooks/*.ts) built and served by `eve dev` / deployed as
 * its own service, and a session is started over HTTP with an auth token.
 * There is no in-process "run this definition" API to map `AgentDefinition`
 * onto, so the honest mapping is a generator plus an HTTP client, which does
 * not fit the "small adapter" budget today. README.md documents the mapping;
 * this stub keeps the `Runner` seam so a client can plug it in later without
 * touching the agents.
 */
export function eveRunner(): Runner {
  return {
    name: 'eve',
    run() {
      return Promise.reject(new Error('eve adapter not available: see packages/agents/README.md, "eve adapter"'))
    },
  }
}
