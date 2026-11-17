# Global agent guides

The craft every Sitekick agent brings to every site: how to compose a page, write for it and
keep it usable. A site's own guides (its `agent/` folder) sit on top and win where they
disagree. See "Guides" in `../README.md`.

Each guide is Markdown with frontmatter:

```md
---
description: One line the agent reads to decide whether it needs this guide.
load: always        # always | on-demand (default)
agents: [edit]      # which agents see it (default: all)
---
```

`always` guides go into the agent's instructions, so keep them short. `on-demand` guides are
listed by name and description, and the agent reads the ones a task needs with `read_guides`.

After changing a file here, run `bun run guides` in `packages/agents`; `src/guides/global.ts` is
generated from this folder, and a test fails when it is stale. Judgment goes here; anything
that must always hold belongs in code, as a validation or a check.
