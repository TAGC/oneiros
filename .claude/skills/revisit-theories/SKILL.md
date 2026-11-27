---
name: "revisit-theories"
description: "Bring the open theories up to date with what has changed since each was posted: questions settled, pages edited, other theories accepted or rejected. Use when asked to revisit, refresh or review the theories, or after a session settles questions that open theories claim."
---

# Revisit theories

A **theory** (`.claude/skills/theorise`) is written against the design as it stood on one day. The design moves: questions are settled, pages change, other theories are rejected or marked promising. This skill checks each open theory against what moved and brings it up to date.

The words of this process are defined in `docs/theories.md`.

It keeps theories honest; it does not improve them. It never adds an answer, a rule or a term to a theory, never edits a wiki page and never touches a question issue. A theory stays Claude's suggestion throughout.

## 1. Read the state

- Run `bun run pull`.
- List the open theories: `gh issue list --state open --label kind:theory`. If the designer named some, take only those. Read each one's body and comments, and note the date it was posted or last revisited.
- Done when you have, for each theory, its rules, its answers with their source lines, its relations and its date.

## 2. Find what moved

For each theory, check these against the repo and the question cache. Only changes since the theory's date count.

- **Questions it claims.** Is each still open? For a closed one, read the answer comment: does it confirm the theory's answer, contradict it, or settle it another way?
- **Source lines.** Find every quoted line in its file. Is it still there, word for word? Has the page's status changed? Has a settled rule the theory overturns been changed by the designer anyway?
- **New rules.** Has a decision settled something a rule proposes, either way?
- **Related theories.** For each theory it is a rival of or builds on: rejected, promising, or closed as overtaken?
- **New questions.** Are there questions opened since that its rules would answer?

Finding these is your job. Never ask the designer what changed.

## 3. Decide the outcome

One outcome per theory:

- **Unchanged:** nothing it rests on moved. Do nothing and say so.
- **Strengthened:** a decision confirmed an answer or settled a rule its way.
- **Refreshed:** quotes or statuses changed, and the claims still hold.
- **Weakened:** a decision contradicted an answer, or a source line no longer holds, and the core rule survives.
- **Overtaken:** a decision contradicts the core rule, no answer is left open, or a theory it builds on was rejected.

## 4. Update

Edit the issue body (`gh issue edit <number> --body-file <file>`), keeping the shape in `.claude/skills/theorise`:

- **Confirmed answer:** tick its checkbox and add "Settled by #<number>" with a link. Its *needs* line becomes *from* `closed #<number>`.
- **Contradicted answer:** strike it through and add "Settled otherwise by #<number>". Do not delete it.
- **Moved quote:** replace it with the page's current wording. If the new wording no longer supports the claim, relabel the line as *stretches* or *overturns*, or drop the claim.
- **Changed status:** update the status beside the page name.
- **Rule settled as proposed:** it stops being a new rule. Move it out of New rules and cite the decision.
- **Related theory changed:** update the Relations line.

Then check the vocabulary and links as step 5 of `.claude/skills/theorise` does.

When a new rule's own text had to change, or an answer now rests on different sources, run one round of the defence in step 6 of `.claude/skills/theorise` on the changed parts only, and record it in the folded Defence section.

Post one comment on the issue: the date, the outcome, and each change in a line with the decision or commit that caused it.

Two things are never done silently:

- **New reach.** If the theory's rules would answer a question opened since, say so in the comment as a suggestion. Add it to the body only when the designer agrees.
- **Overtaken.** Propose closing it, with the decision that overtook it. Close it (as not planned, with a link) only when the designer agrees. Name any theory that builds on it.

## 5. Report

One line per theory: its title with a link, the outcome and the reason. Then list what waits on the designer: theories proposed for closing, and new reach suggested. If every theory is unchanged, say so in one line.
