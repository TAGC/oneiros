---
name: "viva"
description: "Sit the designer down as the final examiner of a theory: present it one piece at a time, take the designer's move on each (ask, challenge, correct, amend, lean, refute, accept, park), answer challenges with proof, and record the outcome on the theory's issue. Use when asked for a viva, or to go over, examine, accept or refute a theory."
---

# Viva

A **theory** (`.claude/skills/theorise`) has been defended against examiners. In a viva the designer is the final examiner. You present the theory and answer for it. The designer's word is final and needs no proof.

The words of this process (piece, move, stale, land and the rest) are defined in `docs/theories.md`. Use them exactly, and never borrow a game term for one: say "park", never "hold".

The designer's word works on two layers. On the theory it is law: any piece can be struck or reworded with no proof, and unlike an examiner the designer cannot be rebutted away. On the settled design it is not automatic: what the designer says in a viva changes the wiki only when the designer asks for it to be recorded.

A viva settles nothing by itself. A theory is Claude's suggestion until the designer accepts a part of it, and an accepted part becomes design only by being landed the usual way (step 5). CLAUDE.md's "Never invent design" and "Record decisions only when the designer asks" hold throughout.

## 1. Read the theory

- Run `bun run pull`. Read the theory's issue with its comments (`gh issue view <number> --comments`), every question it claims in `.questions/`, and every page it cites.
- If `/revisit-theories` has not run since the theory was posted, check its source lines against the pages first (step 2 of that skill) and tell the designer what moved.
- Done when you can answer for every rule, answer and source line without looking it up.

## 2. Open

In one short message, in the caveman style: the title, the theory in two sentences, the defence verdict in plain words, what it costs (new rules, new terms, overturns) and which answers still depend on it. Say how many pieces follow. Then start.

## 3. One piece at a time

A piece is one claim of what held (a question map's H1, H2 and so on), one new term, one new rule, one answer, one candidate reading of a question map (A1, A2 and so on), or one open objection. Present them in that order: what held first, since rules and readings rest on it. A question map goes like a thesis defence, one reading at a time: after what held, each candidate reading with the rules it needs just before it, since refuting a rule makes the reading moot. A rule several readings need comes once, before the first of them.

For each piece, one message:

- what it says, in Glossary terms;
- what it rests on and what it costs: its *from*, *stretches*, *needs* and *overturns* lines, shortest first;
- the strongest open objection against it, if any, with the author's answer;
- your pick, marked ➡️, worded so "yes" accepts it. A pick is a suggestion.

Start each line with its mark from `docs/theories.md`, so the designer can read the piece at a glance: ✔ *from*, ⚠ *stretches*, 🔗 *needs*, ✘ *overturns*, ❓ an Open or something not said, ⚔ a standing attack. Keep one meaning per mark.

Then wait. Never batch pieces: a move on one reshapes the next.

## 4. The designer's moves

Take whatever the designer says as one of these. If it is unclear which, ask.

Reason with the designer's principles in `docs/principles.md`: they are reasons, never proof.

Fact-check everything the designer says, whatever the move. Before you act on a statement about the design, find what the pages, the data and the closed questions say on it. If they agree, say so with the quote. If they disagree, say so with the quote before doing anything else, and ask whether the designer means to change the design. The designer's word still rules; the check makes sure it is given knowingly. Mark each line of a fact-check: ✔ the pages agree, ✘ the pages clash, ⚠ a stretch or a cost, ❓ no page says.

- **Ask.** A question, or "walk me through a case". Answer from the pages, with quotes, or walk the case step by step, each step quoting the page line or ruling it applies. Say a step no page gives as ❓ not said, and offer it as a question. The theory does not change. Stay on the piece.
- **Challenge.** "This is wrong because...". The designer is now an examiner, and needs no proof. Answer once as the author would in the defence (`.claude/skills/theorise`, step 6): rebut with an exact quote or a worked scenario, patch, or concede. Check the pages before you answer. Try to rebut first, and never defend what you cannot prove. A rebuttal is not an attempt to win: it tells the designer what the pages say, so the designer can tell whether the theory is wrong or the page is. Reply once, then the designer rules: amend the piece, refute it, correct the evidence, or let it stand. Do not argue a second time. When you concede or patch, show the new wording and say the wiki is untouched.
- **Correct the evidence.** "That page is wrong", "I never agreed that", "I have changed my mind". This is not an attack on the theory. It is the designer changing the settled design, or disputing it. Say which source lines it knocks out and what is left of the piece. Then ask whether to record it: a changed rule is a decision to land (step 5); a doubt about where a rule came from is a question issue, or a matter for `.claude/skills/canon-audit`.
- **Amend.** "Make it X instead." Write the designer's words into the piece exactly, marked as the designer's. Say what else in the theory the change touches. An amended rule has not been examined: after the viva, offer one defence round on the changed parts.
- **Lean.** "I like this", or a preference between readings. Note it. It decides nothing.
- **Refute.** "No. It does not work like that." The piece is struck, or the whole theory if it is the core rule. Take the reason in the designer's own words. Then ask one thing: is the reason itself a rule to record? A refutation often says what is true instead.
- **Accept.** The piece is accepted. Ask how sure the designer is, on the page-status scale: Notion, Tenet, Certainty or Dogma. Accepting an answer accepts every rule it *needs* and every *overturns* line under it; say so before taking the yes.
- **Park.** Leave the piece open and move on.

**Rulings.** Whatever the designer says that rules on the theory (an amendment, a refutation's reason, a clarification, an answer to a question) is a ruling. Record every ruling the same way, in chat, on the issue and in any brief:

- The designer's words, quoted exactly and bare. Nothing added inside the quote, and no paraphrase standing in for it.
- Under it, at most two lines headed "Claude's reading:". They carry no ✔ *from* mark unless they quote a page line with its file.
- Anything longer, and anything that carries the ruling to a case the designer did not name, is a question to the designer. Ask it before it goes into any note or brief. Until it is answered it is ❓ not said.
- Claude's reading carries none of the designer's weight. Examiners may attack it like any of Claude's text.

**What was agreed.** When the designer asks what was agreed, give two lists, never merged: first the designer's words, quoted; then Claude's readings, labelled as Claude's.

After a move, note back in a line what it changed, then go to the next piece. When a move makes later pieces moot (a rule refuted, so its answers fall), say which and skip them.

**When a move reaches other pieces.** After any challenge conceded, amendment or corrected evidence, say how far it reaches:

- **Wording only:** no claim elsewhere changes. Carry on.
- **Framing:** it changes a premise that other pieces rest on. Those pieces are **stale**: the examiners attacked the old text, not the new. Name them.

Do not restart the viva and do not carry on as if nothing changed. Present each stale piece re-expressed in the new framing, and say plainly that the re-expression is yours and has not been examined. On a stale piece the designer may ask, challenge, lean, refute or park, but not accept. At the close, offer to have the theory revised in the new framing, with one defence round on the changed parts (`.claude/skills/theorise`, step 6), then a short second viva for the acceptances.

## 5. Close

When the pieces are done, give the tally: accepted, amended, refuted, parked, and the objections now standing in the designer's name.

**Record the viva on the issue.** One comment, "Viva, <date>": each piece with the move made on it; each ruling as "Rulings" in step 4 records it, Claude's readings kept apart; "Accepted Claude's proposal" where they only said yes. Then update the body: tick accepted answers, strike refuted ones through without deleting them, and mark amended text "Amended by the designer".

**Then, by outcome:**

- **Something accepted.** Ask whether to land it now. If yes, follow `.claude/skills/resolve-open-questions` from step 3 for each accepted answer (the edge-case stress test, knock-on effects, undermined questions), then its step 4: an answer comment on each question, a question issue for every new rule or other decision with no question behind it, the pages in English and Chinese, a Glossary page and a `src/i18n/zh-terms.md` entry for every accepted new term, one pull request. The answer comments cite the theory's issue. Close the theory as completed, with a link to the pull request. If only parts were accepted, it stays open with what is left.
- **Something amended, nothing landed yet.** Offer the defence round on the changed parts, then another viva.
- **The theory refuted.** Close the issue as not planned, with the designer's reason. Tell the designer which open theories build on it or are its rivals.
- **Evidence corrected.** Land the changed rule as above, then run `/revisit-theories`: other theories may lean on the same line.
- **Everything parked.** Leave the issue open and say so.

Never land an accepted part without the designer's go-ahead, and never record a refutation's reason as a rule unless the designer says to.
