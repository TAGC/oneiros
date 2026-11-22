---
name: "canon-audit"
description: "Audit a design doc or glossary for claims that went in as canon without the user's explicit agreement, by tracing each claim through its question issue and answer comment, then past chats. Use when asked to audit, check provenance or find unconfirmed decisions."
---

# Canon audit

Finds claims in a source-of-truth document (vision doc, glossary, spec) that were recorded as decided even though the user never explicitly agreed to them. The usual cause: Claude proposes several ideas in one message, the user engages with only part, and a later summary or doc write treats the whole bundle as agreed.

## Rules
- Read-only. The audit never edits the audited documents. Changes happen only after the user decides each item.
- Run the tracing in a separate sub-agent so the chat transcripts stay out of the main conversation. Background it.
- Claude's suggestions are not the user's decisions, even if the user did not object. Provenance is judged by who said it, not who said it last.

## 1. Scope
- Agree the scope with the user (one section at a time works best; start with the area that prompted the audit).
- Extract the exact text of that section from the document into a local file (for a Claude Doc: read the tab with the Docs connector, flatten to text, slice the section). Give the sub-agent the file path, and the full doc text for context.
- If an audit worklist already exists in the project, read it first and skip claims already resolved.

## 2. Sub-agent brief
Tell the sub-agent, in full:
- It is read-only: edit no doc, sheet, memory or project file.
- Split the scope text into individual claims (one rule each).
- For each claim, trace it through issues first. Run `bun run pull`, then find the question issue whose answer landed the claim: grep `.questions/` for its content words, or read `git log` on the owner page for the commit or pull request that says `Closes #N`. Read the issue and its answer comment with `gh issue view N --comments`.
  - The answer comment's provenance line says who supplied the decision: the designer's quoted words are what they agreed; "Accepted Claude's proposal" means they accepted Claude's pick as worded in the answer, not any detail beyond it.
  - The page text must match the answer. A page claim that goes past its answer is unconfirmed until traced further.
  - Decisions made before the move to issues have no answer comment; their commit bodies hold the provenance (`Decided:`, `Designer:` and `Confidence:` lines).
- Where no issue or commit settles a claim, or the answer points to a chat, find where it originated with past-chat search (short content-word queries) and open the chat at the hit. At most about two reads per claim; no paging through whole chats.
- Classify each claim:
  - AGREED: a user turn proposes it, or explicitly accepts that specific point.
  - ACCEPTED IN BULK: the user said yes to a bundle; only the bundle's headline counts as agreed, not its details.
  - UNCONFIRMED: only Claude proposed it, and the user's reply did not address that point, or only a summary or "shall I update the doc" message carried it in.
  - CHANGED: the user agreed something different from what the doc now says, or a later decision made it stale.
  - NOT FOUND: no trace in chats (often first appears in a Claude doc write).
- Return a table: claim | status | evidence (the issue number, commit or chat URL, plus a quote under 15 words from the deciding answer or turn, labelled user or Claude). UNCONFIRMED and CHANGED first. End with claims that contradict each other.
- Include one known example of the failure pattern if you have one, so it knows what to look for.

## 3. Report to the user
- Lead with the counts (unconfirmed, changed, untraceable, confirmed).
- List the unconfirmed and changed items briefly, then contradictions. Mention confirmed items only in a line.
- Do not quote the sub-agent's whole table unless asked.
- Offer two next steps: review the flags one by one, or audit the next section.

## 4. Record the findings
- Flag each unconfirmed, changed, untraceable or contradictory claim with a question issue (format in `README.md` under "Open questions"), saying in its Context what is unconfirmed and where it came from. Put its `[!ISSUE N]` marker on the owner page in both languages. Ask the designer before opening the issues. The `/open-questions/` page collects them.
- Do not keep a separate worklist file. Update the audit-coverage line in `CLAUDE.md` with the sections now audited.
- Add new stale items discovered while recording other decisions the same way.

## 5. Resolving items
- Take items one at a time with the user. For each: keep, cut or reword, in the user's own words.
- Only then edit the page (both languages) and remove its marker. Record the outcome as the resolve-open-questions skill does: an answer comment on the issue, landed by a pull request.
- Never re-record a claim as agreed because the user didn't object to it during review.

## 6. Page status
Each wiki page has a `status:` (Notion, Tenet, Certainty, Dogma; rules on the `/status/` page). An audit also checks it:
- After recording findings, list each audited page whose status no longer fits: a Tenet page whose core claims came back unconfirmed, changed or contradictory should drop to Notion. Propose the demotion; the designer decides.
- A page whose claims all came back agreed, with no open or conflict callouts or question markers left, may be proposed for Certainty. Only the designer raises a status.
- For a status-only sweep without chat tracing, run read-only sub-agents per area. Each reads its pages and proposes Notion or Tenet with a one-line reason citing the deciding issue or callout, never higher. When unsure, propose the lower one. Merge their tables for the designer to approve page by page.
- `bun run check` fails if a Certainty or Dogma page holds an open or conflict callout or a question marker, so resolve them before proposing either.

