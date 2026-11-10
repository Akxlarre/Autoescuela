# Glossary — Writing Great Skills

> Definitions for the **bold terms** in `SKILL.md`. Reconstructed from each term's
> inline usage in SKILL.md (the empty original was restored on 2026-07-05).
> Order follows first appearance in SKILL.md.

- **Predictability** — the agent taking the same _process_ every run (not producing the same output). The root virtue every other lever serves.

- **Description** — the model-facing frontmatter line that does two jobs: state what the skill is, and list the branches that should trigger it. Sits in the context window every turn (see context load), so it earns hard pruning.

- **Context load** — the cost of material that sits in the context window every turn (e.g. a model-invoked skill's description). Paid continuously whether or not the skill fires.

- **Cognitive load** — the cost paid by the _human_ who must remember a skill exists. A user-invoked skill trades context load for cognitive load: you become the index.

- **Model-invoked** — a skill that keeps a description so the agent can fire it autonomously and other skills can reach it. Mechanics: omit `disable-model-invocation`; write a rich, trigger-laden description. Costs context load.

- **User-invoked** — a skill reachable only by the human typing its name; no other skill can reach it and the agent won't auto-fire it. Mechanics: `disable-model-invocation: true`; the description becomes a human-facing one-liner. Zero context load, spends cognitive load.

- **Router skill** — one user-invoked skill that names the other skills and when to reach for each. Cures the piled-up cognitive load when user-invoked skills multiply past what you can remember.

- **Branch** — a distinct way the skill is used; different runs taking different paths through it. One trigger per branch in the description. The cleanest test for progressive disclosure: inline what every branch needs, push behind a pointer what only some reach.

- **Duplication** — the same meaning in more than one place. Costs maintenance and tokens, and inflates a meaning's apparent rank on the information hierarchy. Includes synonyms that rename a single branch.

- **Steps** — one of the two content types: ordered actions in `SKILL.md` — what the agent does, in order. Each ends on a completion criterion.

- **Reference** — the other content type: a definition, rule, or fact consulted on demand. Often a legitimately flat peer-set (all rules on one rung), not a smell.

- **Information hierarchy** — the ladder ranking material by how immediately the agent needs it: (1) in-skill step, (2) in-skill reference, (3) external reference. Deciding which tier each piece sits on is the core design act.

- **In-skill step** — an ordered action in `SKILL.md`; the primary tier. Ends on a checkable completion criterion.

- **In-skill reference** — a definition/rule/fact kept in `SKILL.md`, consulted on demand.

- **External reference** — reference pushed out of `SKILL.md` into a separate file, reached by a context pointer and loaded only when the pointer fires. Spans _disclosed_ siblings (like `GLOSSARY.md`) through fully external files any skill can point at.

- **Completion criterion** — the condition that tells the agent a step is done. Make it _checkable_ (done vs not-done) and, where it matters, _exhaustive_ ("every modified model accounted for"). A vague one invites premature completion.

- **Premature completion** — ending a step before it's genuinely done, attention slipping to _being done_. Defence: sharpen the completion criterion first; only if it's irreducibly fuzzy and you see the rush, split off the post-completion steps.

- **Legwork** — the digging the agent does within the work. A demanding completion criterion drives thorough legwork whether the skill has steps or reference ("every rule applied" binds flat reference as "every step done" binds a sequence).

- **Progressive disclosure** — the move down the ladder: out of `SKILL.md` into a linked file, so the top stays legible. Mechanics: a linked `.md` in the skill folder named for what it holds.

- **Context pointer** — the wording that reaches external reference. Its _wording_, not its target, decides when and how reliably the agent loads the material.

- **Co-location** — keeping a concept's definition, rules, and caveats under one heading rather than scattered, so reading one part brings its neighbours. Decides _what sits beside_ a piece once the ladder has decided _how far down_ it sits.

- **Granularity** — how finely you divide skills. Each cut spends one of the two loads, so split only when the cut earns it. Two cuts: by invocation, by sequence.

- **Leading word** — a compact concept already in the model's pretraining that the agent thinks with while running the skill (e.g. _lesson_, _fog of war_, _tracer bullets_). Anchors a region of behaviour in the fewest tokens by recruiting priors the model holds. Serves predictability in both body (execution) and description (invocation).

- **Post-completion steps** — the steps still ahead of the current one. When visible they tempt the agent to rush the step in front of it (premature completion); hiding them via a sequence split encourages more legwork.

- **Single source of truth** — one authoritative place for each meaning, so changing the behaviour is a one-place edit.

- **Relevance** — the pruning test: does this line still bear on what the skill does?

- **No-op** — a line the model already obeys by default, so you pay load to say nothing. Test: does it change behaviour versus the default? A weak leading word (_be thorough_) is a no-op; fix with a stronger word (_relentless_), not a new technique.

- **Sediment** — stale layers that settle because adding feels safe and removing feels risky. The default fate of any skill without a pruning discipline.

- **Sprawl** — a skill simply too long, even when every line is live and unique. Cure: the ladder — disclose reference behind pointers, split by branch or sequence so each path carries only what it needs.

- **Collapse** — to retire restatements into a single token, usually a leading word (e.g. "fast, deterministic, low-overhead" → _tight_). Wins twice: fewer tokens and a sharper hook.
