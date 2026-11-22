---
name: "link-questions"
description: "Propose links between question issues for the designer to approve: blocked-by links, Related rows and likely duplicates, each with a one-line reason, then apply the approved plan. Use when asked to link, order or dedupe the open questions, or after many questions are opened."
---

# Link questions

Question issues link in three ways (README, "Open questions"):

- **Blocked by**: B cannot be settled until A is. B's answer depends on A's: B asks for a detail of a mechanic whose existence or shape A still asks about, or B's options presuppose one of A's outcomes. Sharing a topic is not enough.
- **Related**: worth reading together when settling either one, with no order. Two questions on one page about different rules are not related by that alone.
- **Duplicate**: two issues asking the same question, often a `kind:conflict` and a `kind:open` about one rule, or one question raised on two pages. Two questions asking different parts of one rule are related, not duplicates.

Every proposed link is **grounded**: a one-line reason that names the rule, words or option in the question texts or pages that create the dependency or overlap. A link is never a place for design: a reason may only lean on what a page or a question already says. When a link would need an unstated rule to hold, leave it out; when it holds but is thin, end its reason with `(weak)`.

The links are **stable**: a sound existing link stays as it is. Propose a removal only for a link that fails the definitions above, with its reason.

Nothing is written to GitHub until the designer approves it.

## 1. Read

- Run `bun run pull`. Read the questions through the cache, `.questions/<number>.md`: title, Page and Section rows, Related and Undermined by rows, `blockedBy` in the frontmatter, Context and the `## en` text. Closed questions count as blockers and context only.
- For each open question, read its page's section and the term pages its text names, in `src/content/wiki/`.
- Done when you can say, for every open question, which rule it asks about and on which page that rule lives.

On a first run or a large backlog, fan out with the Agent tool: write an index of every question (number, area, kind, status, title, page, section, text, Context) to the scratchpad, give one read-only subagent a few areas each with this skill's definitions and the plan grammar below, then do one cross-area pass yourself that merges, dedupes and checks the edges.

## 2. Propose

Write the proposal to `<scratchpad>/links-plan.md`, grouped by area (an item goes under the area of the first issue it names), each item on one line with its reason:

```md
## Memory

### Blocked by
add #145 blocked-by #142: #145 asks how fast vividness fades, so #142 must first say whether it fades.

### Related
add #139 related #142: both ask about fading on [[Memory]] (Vividness section).

### Duplicates
duplicate #145 #142: both ask whether vividness fades; keep #142, the open question on the rule; #145 is the conflict over its example.

### Removals
remove #150 blocked-by #139: #150 asks about Hold, which #139's answer does not touch.
```

Check the edges before showing them:

- No cycles. Prefer the minimal edge: if A blocks B and B blocks C, leave out A blocks C.
- A pair joined by blocked-by needs no Related row.
- A pair proposed as duplicates gets no other link between them.
- Every `#N` is a question issue in the cache, and no item repeats another.

End the file with the plan the helper applies: every blocked-by, Related and removal line, in one `question-links` block. Duplicates stay out of it (step 4).

Done when every item has a grounded reason and every check passes.

## 3. Review with the designer

- Lead with the counts (blocked-by, Related, duplicates, removals), then take one area, or a batch of at most five items, at a time.
- For each item: the line and its reason, and Claude's view of how sure it is. The designer accepts, rejects or rewords it.
- Delete each rejected line from the `question-links` block and rewrite each reworded one. The block then holds only approved lines.

## 4. Apply

- Run `bun run links <scratchpad>/links-plan.md` (a dry run). Check that every change it prints is an approved line, and show the designer the output.
- On the designer's go-ahead, run it again with `--live`, then `bun run pull`.
- Duplicates follow the README's duplicate flow through `resolve-open-questions`: the designer picks the canonical issue and the page that keeps its marker, and a pull request replaces the other marker before the duplicate is closed. List each approved pair, with the designer's pick, in the hand-over.

## 5. Report

The counts applied, the duplicate pairs and picks waiting for `resolve-open-questions`, and any item the designer parked.
