---
name: "theorise"
description: "Write a theory: a short proposal that explains several open questions and conflicts at once from the settled design, written by several independent agents and picked by blind judges, or written up from the designer's own hunch, then defended by examiners. Use when asked to theorise, to propose a theory, or to test or defend an idea of the designer's. One run writes one theory."
---

# Theorise

A **theory** is a short proposal about how the game works. Its author studies the settled design as evidence, looks across the open questions and conflicts, and proposes the most elegant account that makes several of them fall out as consequences. It is Claude's suggestion and nothing more: the designer marks it promising, rejects it or notes changes. A promising theory is fleshed out later, in a normal session with the designer.

A theory explains; it does not invent for the sake of it. It may propose a new mechanic only when that mechanic makes the whole design simpler or more consistent: when settled rules already imply it, or when one new rule replaces several open questions. Each new rule must earn its place, and a theory with fewer new rules beats one with more. Radically new mechanics are the designer's own work, not a theory's.

The words of this process (source lines, examiner, standing attack, earned answer, question map and the rest) are defined in `docs/theories.md`. Use them exactly.

A theory never edits a wiki page, never adds a marker, never answers or closes a question issue and never has a Chinese version. CLAUDE.md's "Never invent design" holds throughout.

## Two ways in

- **Invent run:** `/theorise <area or question>`, or `/theorise` alone. Steps 1 to 8 in order: theorycrafters invent, blind judges pick, examiners attack.
- **Hunch run:** the designer states an idea of their own in words, a **hunch**. Steps 1 and 2, then step 5 as written there for a hunch, then steps 6 to 8. No theorycrafters and no judges.

In a hunch run the designer's words are the core of the theory. Quote them exactly. No agent changes or reinterprets them, the chair included. The rule on new mechanics above binds the text Claude writes around them, not the hunch itself. The result is still not a decision: it becomes design only as any theory does, through a viva.

## 1. Read the state

- Run `bun run pull`, then `bun run constellations`. Read the cache files in `.questions/` for the open questions and conflicts.
- List the earlier theories: `gh issue list --state all --label kind:theory`. Sort them by state (see "Other theories" below): **rejected** (closed as not planned), **accepted** (closed as completed), **promising** (open, with the designer's 👍) and **unreviewed** (open, no verdict yet). Read the designer's reactions with `gh api repos/{owner}/{repo}/issues/<number>/reactions`; only the designer's count. Read the rejected ones with the designer's notes, the accepted ones only for what they landed, and the promising ones in full.
- Check each open theory against the questions settled since it was written. If a decision contradicts one of its rules or answers, tell the designer it is overtaken and propose closing it with a link to the decision. An answer the decision merely confirms is ticked off, not a reason to close.
- Read the `/status/` page rules and note each page's `status:` frontmatter.
- Do not use `.chats/` or the Dream seeds. They are private, and a theory is published.
- Done when you know which questions are open, how they cluster and which pages they sit on.

## 2. Write the shared brief

Write one brief file in the scratchpad, with the output of `bun run constellations` and a list of pages by status beside it. Every theorycrafter, judge, examiner and author reads these and nothing else from you. A hunch run writes the same brief; the hunch itself goes in the submitted theory (step 5), not here.

- The project in a paragraph, from CLAUDE.md's opening and "Settled background".
- What a theory is, from the top of this skill, including the rule on new mechanics.
- The open questions and conflicts, with the full text of each in `.questions/N.md`. If the designer named a focus when asking (a constellation, a page, some questions), give it as the scope. Otherwise do not pre-pick a target, and scope is free: a theory may cover one question, one constellation or several constellations at once. Naming, spelling and exact-number questions are not targets for their own sake.
- The evidence, and how much each status weighs. A theory may challenge settled design; what a challenge costs depends on how settled the page is, and the theory must gain more than it costs. Most of the design is Notion or Tenet today, so most of it can move.
  - **Notion**: tentative. Challenge it freely.
  - **Tenet**: the premise is accepted but not fixed. Changing its details is ordinary. Challenging its premise is allowed when the theory gains a lot from it.
  - **Certainty**: the designer is sure. Challenge it only with a strong case.
  - **Dogma**: locked. A theory that contradicts one is out.
  - Every challenge is said plainly in an *overturns* or *stretches* line (step 3), never slipped in.
  - Rules written as settled on a page, and answer comments on closed question issues, are evidence, weighed by the page's status.
- Where to read: `src/content/wiki/` (term pages, `kind: term`, are the Glossary), `src/data/sheet/`, closed issues in `.questions/`.
- The vocabulary rules:
  - Every game concept is named by its Glossary term, spelt and capitalised as its page does. No synonyms and no loose verbs: write "cast a bolt of Joy at Elation", never "hurl Elation".
  - Link each Glossary term to its page at its first use in each section: `[bolt](https://tagc.github.io/oneiros/wiki/bolt/)`. The slug is the page's file name.
  - Never stretch a term to a new meaning silently. A changed meaning is a *stretches* or *overturns* line on that term's page.
  - If no term fits a concept the theory needs, propose one under **New terms**. It would become a Glossary page if the theory is accepted. Until then write it in italics, never as if it were settled.
  - Ordinary words stay ordinary: do not use a plain word as if it were a term.
- The other theories, by state:
  - rejected: one line each, as ground already covered;
  - promising: the full text. A new theory may build on one;
  - unreviewed: only the question numbers each one claims, not its content. Unless the designer named a focus, steer towards questions no open theory claims, so rivals do not pile up.
- No open theory is settled design. None may be cited in a *from* line.
- The output shape in step 3.
- The designer's principles from `docs/principles.md`, word for word. They are rules of thumb the designer set: a reason a theory or an examiner may give, never a *from* line and never proof.
- No lean of your own, and no hint of which questions you think matter most.

## 3. Theorycrafters (invent run)

Launch three sub-agents in parallel, in the background, on different models where possible. Each reads the brief and the repo, roams freely and writes one theory to its own file. The work is read-only.

To keep the three apart, give each a different starting point, and say it is only a starting point: one starts from the conflicts, one from the largest constellations and the questions that block others, one from the foundation pages (cosmology, force, held and manifest, will in motion) and what they imply.

Every theory has the same shape, 900 words at most:

- **Title:** a short noun phrase.
- **The theory:** the account in a few plain sentences.
- **How it plays:** one or two concrete moments from the player's side.
- **New terms:** each word the theory coins: the term, a one-sentence definition that links every Glossary term it uses, and why no existing term fits. "None" if none.
- **New rules:** each rule the theory adds, numbered R1, R2 and so on, with its source lines and a *why* line: why the design is simpler with it than without. "None" if none. Give each part the designer could accept or strike on its own a number of its own; never bundle separable clauses under one rule. Everywhere else, including a question map, cite a rule by its number.
- **Answers:** each question or conflict it would settle, by issue number, with the answer in a line or two and its source lines. Only questions the theory truly settles; no answers stapled on. An answer to part of a question says which part.
- **Opens:** new questions the theory would raise.
- **Weaknesses:** at least three, honest, each with a mitigation.

Source lines sit under the rule or answer they belong to. There is no separate evidence or challenges section. Each line is one of:

- *from* `<page> (<status>)` or `closed #<N>`: a settled rule gives this. Quote or closely restate it.
- *stretches* `<page> (<status>)`: a settled rule used beyond what its page says. Say how.
- *needs* `R<n>`: this holds only if that new rule is accepted. To build on a promising theory, name its rule: *needs* `✧#<issue> R<n>`. The new theory then falls if that one is rejected.
- *overturns* `<page> (<status>)`: a settled rule this changes or breaks. Quote it.

An answer with only *from* lines costs the designer nothing to accept. Every *needs*, *stretches* and *overturns* is a cost, and none may be left out.

Theorycrafters, judges and examiners write these words plain. The marks of `docs/theories.md` (✔ ⚠ 🔗 ✘ ❓ ⚔) go in only when the issue is written (step 7).

After the theory, under a `---` line, a short rationale: the alternatives considered and why they were rejected.

## 4. Blind judges (invent run)

Follow steps 3 and 4 of `.claude/skills/blind-design-bakeoff`: strip the titles and rationales, label the three P, Q and R, and give them to three judges in rotated order. Judges read the brief and the anonymised theories, then check each theory against the repo: the pages it cites and the `.questions/N.md` file of every question it claims to answer.

Score 1 to 5 with a sentence each:

- **Evidence:** are its source lines true, and is every stretch and overturn declared, none hidden;
- **Reach:** how many open questions and conflicts it truly settles, counting only real consequences;
- **Parsimony:** how few new rules, new terms, stretches and overturns it needs for that reach, each weighed by its page's status, and whether each one earns its place;
- **Play:** is the result fun, readable and systemic;
- **Theme:** the Dreamlands and Mainländer.

Judges also check vocabulary against the term pages: a loose word standing in for a term, a term used outside its definition, a coined word not listed under New terms, a new term that duplicates an existing one. These count against Evidence.

Each judge also gives a recommendation with confidence, each theory's biggest underplayed flaw, a list of factual errors with the file checked, the points where the theories agree and differ, and the ideas worth taking from the losers.

## 5. Pick and correct

- Take the theory with the highest total. Say whether the judges agreed. When all three reach the same core, say so: that agreement is itself evidence.
- Work out its relation to each open theory, from the questions they both claim and the rules it uses (see "Other theories").
- Apply the judges' fact-check: drop every claimed answer that does not truly answer its question, relabel any source line that is wrong (a *from* that is really a *needs* or a *stretches*), and add every hidden *overturns*.
- Check every issue number, quote and page claim yourself against the cache and the pages. Remove any claim you cannot trace.
- Check the vocabulary: every wiki link resolves to a file in `src/content/wiki/`, every linked term is used as its page defines it, and every remaining loose word is replaced by its term or moved to New terms.
- Fold in at most two ideas from the losers, only where the judges asked for them and the result stays one theory. Folding in none is fine.
- A strong loser that covers different questions is not a graft: name it in the report as a theory for a later run.
- If every theory scores under 3 on Evidence, publish nothing and say why.

**In a hunch run**, there is nothing to pick. Instead:

- Fact-check the hunch against the pages, the data and the closed questions, and tell the designer what they say before writing anything. Mark each line: ✔ the pages agree, ✘ the pages clash, ⚠ a stretch or a cost, ❓ no page says. On a ✘, quote the page and ask whether the designer means to change it.
- Write the theory in the step 3 shape. Under **The theory**, quote the designer's words exactly, headed "The designer's words". Claude's account follows, headed "Claude's write-up": the source lines, How it plays, Answers, Opens and Weaknesses. Only the write-up may be attacked as Claude's text; the designer's words are attacked only through what they give in a worked case.
- Run the checks above on the write-up: issue numbers, quotes, page claims, vocabulary.

The result is the **submitted theory**: the text the defence examines.

## 6. Defence

The theory is defended like a thesis: examiners attack it, the author answers, and they go again. An attack counts only when it is proven. You are the chair: you check proofs and call the verdict, and you neither attack nor defend.

**Examiners.** Three sub-agents, one lens each, on different models where possible, and on cheaper models than the chair's. Each reads the brief and the submitted theory, and may read the repo. They report attacks only and fix nothing.

- **Canon:** the theory against the settled design. A source line that is false, a settled rule it breaks without an *overturns* line, a Glossary term misused, an answer that does not answer its question.
- **Exploiter:** a player trying to break or abuse the rules. A loop with no end, a free gain, a mechanic made pointless, a moment that is unreadable or no fun.
- **Occam:** what can be cut. A new rule or term the answers do not need, a simpler reading of the settled rules that gives the same answers, an answer bought at too high a cost. When the theory is a rival of an open theory, Occam also reads that theory and attacks whichever answer costs more for the same question, with proof.

**Proof.** Every attack carries one of:

- a **quote**: the exact line from a page, sheet or closed issue that the theory contradicts, with the file;
- a **worked scenario**: a concrete case walked step by step, using only the theory's rules, settled rules and the designer's rulings, ending in a broken result. Each step quotes the page line or ruling it applies, with its file or where the ruling was given.

No page, no proof. A step that no page line or ruling gives is an **unsourced step**: the examiner marks it "not said" rather than filling the hole with a plausible rule. A scenario with an unsourced step proves nothing. It is a **gap**: a question for the designer, "no page says whether X", reported apart from the attacks, never as a standing attack.

An objection with no proof is not reported. Taste, style and risks that need some future rule to matter are left out. A declared *stretches*, *overturns* or *needs* line, or a declared Open, is an allowed cost and not an attack by itself. No attacks is a valid result. Each examiner reports at most six attacks in the first round and four in later ones, strongest first, each with its target, its proof, what breaks and a severity: core, answer or minor.

**Rounds.**

1. **Attack.** The three examiners attack the submitted theory, in parallel.
2. **Check.** Re-check every proof yourself: find the quote in the file. Walk every step of every scenario: find the line or ruling the step quotes, and ask whether it gives that step, not merely one like it. A step with no line behind it, or with a line that does not give it, is unsourced: move the scenario to the gaps, whoever found it. Several examiners reaching the same scenario is not proof; check it as one. Drop any attack whose proof fails, and merge attacks with one root cause. What is left are the **standing attacks**.
3. **Answer.** Resume the theorycrafter who wrote the winning theory and give it the standing attacks. In a hunch run, start one author sub-agent instead, on a cheaper model than the chair's, and resume it in later rounds. It answers each one:
   - **patched:** the theory is changed. Say what changed;
   - **conceded:** the attack is right and the claim is withdrawn: an answer dropped, a rule cut;
   - **rebutted:** the attack is wrong, shown by a quote or a worked scenario of its own. A rebuttal with no proof is a concession.
   The author tries to rebut first. For each scenario it first tests every step for an unsourced step: a step that only sounds like a rule. Then it looks for the settled line or the scenario that defeats the attack, and gives way only when it finds none. Every concession and every patch says where it looked. An author who never rebuts is not defending: if a round has no rebuttal, check two of its concessions yourself for a defence it missed, and send those back.
   It returns the revised theory and its answers.

   In a hunch run the author may change the write-up but never the designer's words. Where an attack can be met only by choosing a reading of those words, it does not choose: it states each reading and its bill, as a question for the designer. Put each such question to the designer before the next round, one at a time. The answer is a ruling, recorded as `.claude/skills/viva` says under "Rulings"; give the examiners the rulings in the next round's brief. A question the designer parks keeps its readings in the theory as rival candidate answers.
4. **Go again.** Resume the same examiners with the revised theory and the answers. Each says whether its attacks are met, and attacks only what changed and any rebuttal it can disprove. Then check and answer as before.

Stop when a round leaves no new standing attack, or after three rounds.

**The last word.** After the final round, the author answers that round's standing attacks once more, with *rebutted* or *conceded* only. It may not change the theory. A proven rebuttal removes the objection; the rest are published with the author's answer beside them. The author then closes with its own judgement in 120 words at most: what the designer should take from the theory now, what it is most sure of and what it is least sure of.

**Counter-theories.** An examiner, usually Occam, may prove that a different reading gives the same answers at lower cost. That is a **counter-theory**. The author may:

- rebut it with proof;
- adopt it, rewriting the theory around it. Say so plainly in the report and the issue: who proposed it and in which round. The reading the theory began with moves to Opens as the rival, with its costs stated as fairly as the adopted one's;
- keep its own reading and present the counter-theory under Opens as the rival, when the two differ in a way only the designer can choose between.

An adopted counter-theory is new text that no one has attacked. It gets at least one full round from all three examiners and one answer from the author, even if that means a fourth round. The examiner who proposed it does not examine it: start a fresh examiner on that lens for the remaining rounds.

**Guards.**

- A patch that adds a rule or a term is a cost. If the theory ends with more new rules than it began with, say so in the report, and weigh whether conceding would have been better.
- The theory may shrink. Dropping an answer or a rule to survive is a good outcome, not a failure.
- Count what is left by **earned answers**: answers that would not stand if the theory's rules or reading were deleted. An answer the settled pages already give is free to list, but it is not reach.
- You may correct a plain wording error an examiner proves, such as "settled" for a line the page marks unconfirmed. Say so in the Defence log. You change nothing else.
- Attacks still standing after the last round stay in the theory as **open objections**, with their proof. Never hide one.

**Verdict.**

- **Passed:** no attack ever stood, or every one was rebutted.
- **Passed with corrections:** attacks stood and were patched or conceded, and none stands now.
- **Passed with open objections:** attacks still stand, and the core rule or reading and at least one earned answer survive them.
- **Reduced to a question:** the defence shows that the settled pages do not decide between two or more readings, and every earned answer left depends on which one is chosen. The theory has not failed: it has mapped the question. Publish it as a **question map** (step 7), not as a theory to accept.
- **Failed:** a standing attack breaks the core rule or reading, or no earned answer survives, and no map of readings came out of it. Publish nothing. Report the theory and what broke it; the runner-up is a candidate for a later run, not a replacement in this one.

Beside the verdict, give the tally: rules, terms, overturns and earned answers at submission and now. When few earned answers are left, say so in plain words in the first line of the issue and in the report, naming them: "Only one answer (#53) still depends on this theory." Do not use a label such as "thin" that the designer has to look up.

**Side findings.** The defence often turns up trouble in the settled pages themselves: two settled lines that clash with no theory involved, or a rule with no result in an ordinary case. Keep each with its quotes. They are not part of the theory. List them in the report and propose a question issue for each (`kind:conflict` or `kind:open`, in the format of `docs/open-questions.md`); open them when the designer agrees.

**Gaps.** Keep each gap with its scenario and the unsourced step named. A gap is not an attack and does not count against the theory, but it is not cleared either: it goes under Opens, and to the designer in the report.

After the last round, run the checks of step 5 once more on the final text.

## 7. Publish

Open one issue for the theory:

`gh issue create --title "✧ <Title>" --label kind:theory --body-file <file>`

The body is the defended theory in the step 3 shape, with these changes so the designer can review it on the issue itself:

- a first line saying it is Claude's suggestion, not a decision, with the defence verdict. For a hunch run: that it is the designer's hunch, written up and defended by Claude, and not a decision;
- a legend line beneath it: `✔ from · ⚠ stretches · 🔗 needs · ✘ overturns · ❓ open or not said · ⚔ standing attack`;
- every source line starts with its mark and keeps its word, as `✔ *from*`, `⚠ *stretches*`, `🔗 *needs*`, `✘ *overturns*`. Each Open and each "not said yet" line starts with ❓, and each open objection or standing attack with ⚔. Never use a mark without its word: the words are what a search finds;
- a **Relations** line: each open theory it is a rival of, builds on or would supersede, as `✧#<issue>` links, or "Independent". Add a comment on each of those issues linking back;
- each Answer is a task-list checkbox, `- [ ] **#<number>** <title>`, with its answer and source lines beneath it;
- an **Open objections** section in place of Weaknesses when any attack still stands: each with its proof and the author's last answer. The author's own weaknesses that no examiner raised follow it, shorter;
- a folded `<details>` "Defence" section: a table of attacks reported, standing, patched, conceded and rebutted per round; each round's standing attacks with proof in one line and the answer; any counter-theory adopted and who proposed it; and what the theory lost or gained across the rounds;
- each gap under Opens, as `❓ No page says whether X`, with the scenario that found it in one line;
- the designer's rulings from the run, as `.claude/skills/viva` records them under "Rulings";
- in an invent run, a folded `<details>` "Judging" section: this theory's score table, whether the judges agreed, the totals, the losers in one line each and what was changed after judging;
- a last line: react 👍 promising or 👎 reject, tick the answers you like, or comment to change it.

A **question map** uses the same issue and label, with a different body:

- the first line says it is a question map, names the question it maps, and says the settled pages do not decide it;
- the same legend line and the same marks as a theory;
- **What held:** the claims that held against every examiner, one per bullet, numbered "**H1.** …", "**H2.** …", each with its source lines. Give each claim the designer could accept or challenge on its own a number of its own, as with rules. Rules and readings that rest on one cite it by its number;
- **Rules:** each new rule any reading needs or carries, stated once as "**R1.** …" with its source lines, as under New rules in step 3. "None" if none. Readings and objections cite a rule by its number only;
- **Candidate answers:** one task-list checkbox per reading, numbered A1, A2 and so on ("- [ ] **A1. <its name>.**"), each with what it says in a line or two, how it plays, and its full bill on the same terms as the others: overturns, stretches, new rules (by number) or terms it needs, and what it costs or gains in play. Say who proposed each reading: a theorycrafter, or an examiner and in which round;
- the author's closing judgement;
- Opens, then the folded Defence and Judging sections as usual;
- a last line: tick the reading you favour, comment, or ask for a viva.

A question map makes no recommendation. If the bills clearly favour one reading it was not reduced to a question: it is a theory with a rival.

The marks are for theory issues only. A question issue (`kind:open` or `kind:conflict`) never uses them: its text renders on the wiki.

`bun run pull` ignores this label, so the wiki and the Astrolabe are unaffected. Do not comment on the question issues and do not touch any page.

## 8. Report

Give the designer the issue link, the title, the theory in two sentences, the questions it covers, how many new rules and terms it adds, and the defence verdict with the count of rounds and open objections. For a question map, give the question, the candidate answers in a line each, and what held; offer to take it into the next `resolve-open-questions` session for that question's constellation. Then the side findings, each with its proposed question issue, and the gaps, each as a question to the designer. **What the designer can do with it.** The full set of moves is in `.claude/skills/viva`: ask, challenge, correct the evidence, amend, lean, refute, accept, park. A viva is the place to accept or refute a theory. Between vivas, the issue takes quick signals:

- 👍 **promising:** the reaction itself is the mark; add no label. It waits for a viva. On a question map, a ticked reading is the designer's lean, not a decision.
- 👎 **rejected:** close as not planned, with the reason in a comment. Tell the designer which open theories build on it: they fall with it.
- a ticked answer or reading: a lean. Note it for the viva.
- a comment: a challenge or an amendment. Answer it on the issue as the author would in the defence, with proof, once. The next viva takes it up.

Nothing on the issue settles design. That happens only when the designer accepts a part in a viva and asks for it to be landed.

## Other theories

Several theories can be open at once. A new theory stands in one of four relations to each open one:

- **Independent:** they claim different questions and share no rule. Nothing to do.
- **Rival:** they claim at least one question in common and answer it differently. Both stay open and link to each other. The designer picks; never close one for the other.
- **Builds on:** the new theory uses a rule of a promising theory through a *needs* `✧#<issue> R<n>` line. Only promising theories can be built on.
- **Supersedes:** the new theory gives every answer the older one gives, at no greater cost, and more besides. Say so in the report. The older one is closed with a link only when the designer agrees.

A theory is a suggestion in every state. Promising means the designer wants it fleshed out, not that it is settled: it becomes design only through a session that records decisions the usual way.
