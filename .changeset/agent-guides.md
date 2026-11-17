---
"@sitekick/agents": patch
---

Agent guides: Edit with words and Draft now work from layered design, UX and writing guides. The kit ships the general ones; a site adds its own in `agent/` (brand, voice, audience, exemplars, per-block notes) with `loadGuides` from `@sitekick/agents/guides` and `createAgentRoutes({ guides })`. Every block carries a "when to use" note.
