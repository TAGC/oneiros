---
name: "resolve-open-questions"
description: "Work through the wiki's open questions and conflicts (question issues and [!OPEN] or [!CONFLICT] callouts) with the designer, one cohesive group per session: ask one question at a time, answer each on its issue and land the group as one pull request. Use when asked to go over conflicts, open questions or outstanding callouts."
---

# Resolve open questions

The designer settles the wiki's open questions in small sessions. Each session takes one cohesive group, settles it, lands it as one pull request and ends, so the next group starts with a fresh agent.

Each question is a GitHub issue (a **question issue**) with a `[!ISSUE N]` marker on its page. Some pages still hold old inline `[!OPEN]` and `[!CONFLICT]` callouts. The issue format, the answer comment format and the labels are in `README.md` under "Open questions"; follow them exactly.

## 1. Pick a group

- Run `bun run pull`, then list the open questions: `gh issue list --state open --label kind:conflict` and `--label kind:open`, or grep `.questions/`. List the old callouts too: `grep -n -A2 '\[!CONFLICT\]\|\[!OPEN\]' src/content/wiki/*.md*`. The `/open-questions/` page collects both.
- A **constellation** is a ready-made group: a milestone whose title starts with `✦ `, with its size and energy in the description (README, "Constellations"). List them with `gh api 'repos/TAGC/oneiros/milestones?state=open' --jq '.[] | select(.title | startswith("✦ ")) | "\(.number) \(.title)"'` and offer one first. Its questions are `gh issue list --state open --milestone "<title>"`.
- Without a fitting constellation: conflicts before opens. Then opens area by area.
- Prefer questions whose blockers are all settled: an open question blocked by another open question waits for it.
- A group is a set of related, interdependent questions, such as burning, recounting and beads. Keep it small enough for one session. Duplicates of one conflict across pages are one question.
- Tell the designer the group and how many questions it holds, then start.

## 2. Find the facts first

Finding facts is Claude's job, never the designer's. Before asking, read:

- each issue in the group: its property table, Context, blocked-by links and Related issues;
- the answer comments of related closed issues;
- every page in the group, and the pages they link to;
- the data in `src/data/sheet/`;
- the reference sheet, a Claude Sheet at https://claude.ai/artifact/SFhGFU5jpuYinbFNRFfXRG, read through the Claude Docs connector (`guide` topic.sheets, then `read`). Its Glossary tab holds the older definitions.

Many open questions are already answered in one of these. Say so with the source, instead of asking.

The sheet is an older source and is no longer updated. Where it disagrees with a page whose rule was settled (a closed issue's answer, or for older decisions `git log -p` on the page), the wiki wins: do not raise it again as a conflict.

Between unsettled sources, no source wins by default. The sheet was ruled authoritative for the qualities of the will (22 Nov 2026), but every other sheet-against-vision conflict is decided one by one.

## 3. Ask one question at a time

- One question per message, in the caveman style: what the sources say, the options, Claude's pick marked ➡️, worded so "yes" accepts the pick.
- Wait for the answer. Answers reshape later questions, so never batch them, even when they look independent.
- Record the designer's confidence in each decision on the page-status scale: Notion (tentative, may flip, "yes, tentatively"), Tenet (keep and refine; a bare "yes"), Certainty (sure, "yes, definitely"), Dogma (locked, never revisit, "absolutely"). If the designer's wording is ambiguous, ask.
- Note who supplied each decision: the designer's exact words when they add content or reasoning, or "Accepted Claude's proposal" when they only said yes or chose Claude's pick. The answer comment carries this, and a canon audit checks it, so never credit the designer with Claude's idea.
- When an answer adds a new rule, note it back in a line, then ask about its knock-on effects before moving on.
- When the designer states a rule, check it against the pages, the data and the reference sheet before the next question. Surface any contradiction or existing answer at once, with its source.
- Stress-test each settled answer with one concrete edge-case scenario before moving on, for example "you are knocked out mid-recount while rushing a Fixture: is the memory lost, scarred, or both?". The designer's answer may settle a detail or become a new question.
- Picks are suggestions. A pick becomes a decision only when the designer accepts it.
- If a detail of an agreed rule stays undecided, it becomes a new question issue.
- When a decision breaks the premise of an earlier decided issue, tell the designer. If they agree, the earlier issue gains an Undermined by row naming the new one.

## 4. Land the group

Once every question in the group is settled, ask the designer whether to open the pull request. Then:

1. Work on a branch off `main`, never on `main` itself.
2. Make sure every decision has an issue. Every decision the designer asked to record gets one, even with no question behind it: an old inline callout, a knock-on rule, a decision taken along the way. Open it in the README format with `gh issue create --title "<English title>" --label kind:open --label area:<area> --body-file <file>`.
3. Open a question issue for each new open question, and put its marker on the English and Chinese pages.
4. Edit the pages in English and Chinese, following `README.md` and CLAUDE.md. Replace each decided marker or old callout with its outcome as plain rule. Remove the marker of each ruled-out question.
5. When a decision is hard to reverse, surprising to a later reader and the result of a real trade-off (for example "burn only from a bead"), add a short "why" to the owner page's prose, using only reasons the designer gave. Other decisions need no reason on the page; the answer comment holds the provenance.
6. Changing a Tenet page's rules needs no status question; ask only if a change challenges the page's premise itself.
7. Add new blocked-by links and Undermined by rows on GitHub.
8. Run `bun run pull`, then `bun run verify`.
9. Make **one commit per cohesive set of decisions**: usually one for the group, and a separate one for any unrelated decision the session settled along the way. Each commit body says which issues it closes, for example `Closes #142, #145.`, and holds no provenance.
10. Push the branch and open one pull request for the group. Its body lists each decision in a line, says `Closes #N` once per decided issue, and names each ruled-out issue without a closing keyword.
11. While the pull request is open, post one answer comment on every issue it settles, decided or ruled out, with `gh issue comment N --body-file <file>`. The provenance line names the designer's confidence and who supplied the decision (from step 3), and the pull request that lands it.

The issues and their answer comments are the decision record. Do not keep a separate log or write provenance into commit bodies.

The designer merges the pull request; merging deploys. Once it is merged:

1. Close each ruled-out issue with `gh issue close N --reason "not planned"`. Closing it earlier fails the deploy's checks, since its marker still names a closed issue.
2. For each constellation the group drew from, check `gh issue list --state open --milestone "<title>"`. When it lists nothing, close the milestone: `gh api -X PATCH repos/TAGC/oneiros/milestones/<number> -f state=closed`.

## 5. Hand over

Report the pull request, the issues it closes, any ruled-out issues and milestones still to close, new question issues and loose ends, then stop. The designer starts a fresh agent for the next group.
