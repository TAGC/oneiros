---
name: "resolve-open-questions"
description: "Work through the wiki's [!CONFLICT] and [!OPEN] callouts with the designer, one cohesive group per session: ask one question at a time, then commit the group's decisions with their provenance. Use when asked to go over conflicts, open questions or outstanding callouts."
---

# Resolve open questions

The designer settles the wiki's `> [!CONFLICT]` and `> [!OPEN]` callouts in small sessions. Each session takes one cohesive group, settles it, commits it and ends, so the next group starts with a fresh agent.

## 1. Pick a group

- List the callouts: `grep -n -A2 '\[!CONFLICT\]\|\[!OPEN\]' src/content/wiki/*.md*`. The `/open-questions/` page collects them too.
- Conflicts before opens. Then opens page by page.
- A group is a set of related, interdependent questions, such as burning, recounting and beads. Keep it small enough for one session. Duplicates of one conflict across pages are one question.
- Tell the designer the group and how many questions it holds, then start.

## 2. Find the facts first

Finding facts is Claude's job, never the designer's. Before asking, read:

- every page in the group, and the pages they link to;
- the data in `src/data/sheet/`;
- the reference sheet, a Claude Sheet at https://claude.ai/artifact/SFhGFU5jpuYinbFNRFfXRG, read through the Claude Docs connector (`guide` topic.sheets, then `read`). Its Glossary tab holds the older definitions.

Many open questions are already answered in one of these. Say so with the source, instead of asking.

The sheet is an older source and is no longer updated. Where it disagrees with a page whose rule was settled (no callout left, and `git log -p` on the page shows the decision), the wiki wins: do not raise it again as a conflict.

Between unsettled sources, no source wins by default. The sheet was ruled authoritative for the qualities of the will (22 Nov 2026), but every other sheet-against-vision conflict is decided one by one.

## 3. Ask one question at a time

- One question per message, in the caveman style: what the sources say, the options, Claude's pick marked ➡️, worded so "yes" accepts the pick.
- Wait for the answer. Answers reshape later questions, so never batch them, even when they look independent.
- When an answer adds a new rule, note it back in a line, then ask about its knock-on effects before moving on.
- When the designer states a rule, check it against the pages, the data and the reference sheet before the next question. Surface any contradiction or existing answer at once, with its source.
- Stress-test each settled answer with one concrete edge-case scenario before moving on, for example "you are knocked out mid-recount while rushing a Fixture: is the memory lost, scarred, or both?". The designer's answer may settle a detail or become a new `[!OPEN]`.
- Picks are suggestions. A pick becomes a decision only when the designer accepts it.
- If a detail of an agreed rule stays undecided, it becomes a new `[!OPEN]`.

## 4. Commit the group

Once every question in the group is settled:

- Edit the pages in English and Chinese, following `README.md` and CLAUDE.md. Resolve each settled callout and write its outcome into the page as plain rule.
- When a decision is hard to reverse, surprising to a later reader and the result of a real trade-off (for example "burn only from a bead"), add a short "why" to the owner page's prose, using only reasons the designer gave. Other decisions need no reason on the page; the commit body holds the provenance.
- Changing a Tenet page's rules needs no status question; ask only if a change challenges the page's premise itself.
- Run `bun run verify`.
- Make **one commit per cohesive set of decisions**: usually one for the group, and a separate one for any unrelated decision the session settled along the way.
- In the commit body, list every decision:

  ```
  Decided 22 Nov 2026.

  - Q: Does burning shatter the bead?
  - Decided: Yes. The memory is destroyed and the glass shatters.
  - Designer: "should the gem break too?" Accepted Claude's proposal.
  - Resolves: [!OPEN] on burning.md (from bead, within or both).
  ```

  - **Q:** the question that was settled.
  - **Decided:** the outcome.
  - **Designer:** the designer's exact words when they add content or reasoning. When the designer only said yes, or chose Claude's recommended option, write `Accepted Claude's proposal.` This line is what a canon audit checks, so never credit the designer with Claude's idea.
  - **Resolves:** the callouts it closes, if any.

- Commits are the decision record. Do not keep a separate log.
- Push only when the designer says so: pushing to `main` deploys.

## 5. Hand over

Report the commits, any new `[!OPEN]` callouts and loose ends, then stop. The designer starts a fresh agent for the next group.
