# Agent guides for this site

What the site's agents (Edit with words, Draft) should know about this client. They sit on
top of the kit's general design, UX and writing guides and win where the two disagree. Edit a
file and the next run uses it; no restart.

- Top-level files go into every run: keep each short, specific and true. `brand.md`,
  `voice.md`, `audience.md` and `exemplars.md` are the usual set.
- `blocks/<block>.md` replaces a block's built-in "when to use" note, for how this site uses it.
- Anything in another subfolder is read only when the agent asks for it: give it frontmatter
  with a `description` so the agent knows when.
- A file named like a kit guide (`writing/voice.md`, `design/composition.md`) replaces that guide.
- `<!-- comments -->` are for people and never reach the agent. This README is skipped.

Write rules the way you would brief a new designer: concrete, with reasons and examples.
Anything that must never happen belongs in the block's validation, not here.
