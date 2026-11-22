---
name: "chart-constellations"
description: "Keep the constellations (the ✦ milestones that group open questions into sessions) sound: assign new questions, split or merge groups, close finished ones. Use before a resolving session, after questions are opened or closed, or when asked to chart or regroup constellations."
---

# Chart constellations

A **constellation** is a GitHub milestone whose title starts with `✦ `: a cohesive group of open questions sized for one session. The format, the Size and Energy scales and the membership rules are in `docs/constellations.md`; read that section first and follow it exactly.

The chart is **stable**: a sound constellation stays exactly as it is, so a run with no new or newly closed questions changes nothing. Change a constellation only for one of the reasons in step 2.

The helper `scripts/constellations.ts` does the GitHub side. It never touches milestones without the mark.

## 1. Read the state

- Run `bun run pull`, then `bun run constellations`. It lists each open constellation with its open questions, the ungrouped questions and the constellations ready to close. Each question line carries its kind, area, page and graph facts: independent, peripheral or frontier, central, blocked by, blocks.
- Read the cache file `.questions/<number>.md` of every ungrouped question and of every question in a constellation you might change. Skim the page each one sits on.
- Done when you know what each ungrouped question asks and which rule or page it bears on.

## 2. Write the plan

Start from the current chart: `bun run constellations plan > <scratchpad>/constellations.yaml`. The file lists every open constellation and, last, `ungrouped:` for reference. Edit it in place. A new constellation has no `number`:

```yaml
constellations:
  - number: 3
    name:
      en: Fading memories
      zh: 褪色的记忆
    size: small
    energy: low
    reasoning:
      en: How memories fade and what that costs.
      zh: 记忆如何褪色以及代价为何。
    questions: [142, 145]
```

Change the chart only for these reasons:

- **A new question.** Put it in the open constellation it is cohesive with, if it still fits one session; otherwise give it a constellation of its own, or one with other ungrouped questions it belongs with. A one-question constellation is fine.
- **No longer cohesive.** Questions closed or reworded since the last run leave a group that no longer hangs together: split it, or move its strays.
- **Too big for one session.** Split a group of more than eight questions along its natural seam.
- **Two small groups that are one topic.** Merge them, keeping the older milestone's number.
- **All its questions closed.** It is finished: the wiki and the Astrolabe stop showing it as open at once, and `bun run constellations` lists it under "Ready to close". The helper closes its milestone; drop it from the plan or leave it, either way.
- **A duplicate closed.** It leaves its constellation: `gh issue edit N --remove-milestone`. Reword the reasoning if it named the duplicate.

A group is **cohesive** when settling one question shapes the others: one rule, one mechanic, one owner page or a chain of blocked-by links. A blocker and the questions it blocks belong together. Duplicates of one conflict across pages belong together. Areas do not bound a group; shared rules do.

For every new or changed constellation, write:

- **Name:** a short noun phrase in Glossary terms, spelt and capitalised as the wiki does (CLAUDE.md, "Ubiquitous language"). The Chinese name uses `src/i18n/zh-terms.md` exactly.
- **Reasoning:** one to three sentences on why the questions belong together: the rule, page or decision they share. Name the shared theme only: never counts ("all four", "both", "two are conflicts") or a roll call of which question asks what, because questions close and move and those go stale. Describe the questions, never an answer or a lean: the reasoning is not a place for design. The Chinese reasoning says the same, with the term list's words. A term missing from the list goes into the list first, as CLAUDE.md says.
- **Size and Energy:** from the scales in `docs/constellations.md`, judged from the questions. The graph facts feed Energy: independent and peripheral questions pull it down; central questions, conflicts, foundations and Philosophy pull it up. The two scales are independent. Judge both from the questions alone; the designer's time and energy are theirs to match against the scales, never a question to ask.

Leave an unchanged constellation's name, reasoning, size and energy as they are.

Done when every open question is in exactly one planned constellation.

On a first chart or a large backlog, fan out with the Agent tool: one subagent per few areas proposing groups from the cache files, then one pass for merges across areas and the Chinese text.

## 3. Dry run

Run `bun run constellations apply <scratchpad>/constellations.yaml`. It prints the operations: creates, edits, assignments, closes. Fix every error and run it again. A warning means a size does not match the question count: change the size, or keep it when the reading load justifies it and say so in the report.

Check the operations against step 2: each one has a reason there. An edit to a constellation you meant to leave alone means the plan drifted; restore it.

## 4. Apply

When no constellation exists yet (the first chart), show the designer the plan and wait for approval. Otherwise apply it: `bun run constellations apply <scratchpad>/constellations.yaml --live`. The changes are public at once and redeploy the site.

Then run `bun run pull` and `bun run constellations`: no question is ungrouped and nothing is ready to close. Run the dry run again: it says "Nothing to change". Run `bun run build` and `bun run check`: the Constellations check passes.

## 5. Report

List what changed, by constellation, with milestone links: created, renamed or described anew, questions moved in or out, closed. Give any size warnings you kept and why. If nothing changed, say so in one line.
