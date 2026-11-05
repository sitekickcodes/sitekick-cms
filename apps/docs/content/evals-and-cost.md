## AI usage

Admins find **AI usage** in the account menu. It shows:

- this month's spend against last month's, with a projection to the end of the month
- the budget, if `SITEKICK_AI_BUDGET_USD` is set, with a warning when this pace would go over it
- spend per day over the last 30 days
- this month split by agent (Draft from notes, Edit with words, Find details…), by model and
  by who started each run
- what failed runs cost, and the five most expensive runs, each linked to its run

The numbers come from AI Gateway's own cost for each call, recorded on the run. With your own
provider keys (bring-your-own-key), the provider's charge is used.

## Evals

Changing a model or an agent's instructions should be measured, not judged by feel. Each
site has an eval suite in `evals/cases.ts`:

```sh
bun run evals
bun run evals --models anthropic/claude-sonnet-5-5,anthropic/claude-haiku-5-5
bun run evals --case draft/closure-notice
```

Each case runs a real agent with the model under test, on a private in-memory copy of the
site's collections, so nothing touches the database. The proposal is then graded two ways:

- **Exact checks**: a value, a pattern, or a rule such as "the excerpt is under 160
  characters"; and fields that must not be proposed.
- **A judge**: a short rubric that Claude Opus scores from 1 to 5, with a reason. "Every fact
  comes from the notes; nothing invented." 4 or more passes.

```
model                        passed  judge  cost     time
---------------------------  ------  -----  -------  ----
anthropic/claude-sonnet-5-5  3/3     4.00   $0.0714  9.1s
anthropic/claude-haiku-5-5   3/3     4.00   $0.0602  8.3s
```

Every result is appended to `evals/ledger.jsonl` with the model, scores, cost, time and git
commit, so the next change can be compared with this one. A run of the three starter cases
costs a few cents.

### Writing a case

```ts
import { draftCase } from '@sitekick/agents/evals'

draftCase({
  id: 'draft/closure-notice',
  collections,
  input: { targetCollection: 'posts', notes: 'Closed Thursday Nov 27 and Friday Nov 28. Back Monday Dec 1.' },
  expect: { title: /clos/i, excerpt: (v) => String(v).length <= 160 || 'excerpt too long' },
  forbid: ['author'],
  judge: 'States the closed days and the reopening correctly. Short. Invents nothing.',
})
```

`editCase` takes `seed` documents (the page to edit) and an instruction. `enrichCase` reads
the live web, so its results vary from run to run.
