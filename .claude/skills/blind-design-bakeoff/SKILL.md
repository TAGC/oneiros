---
name: "blind-design-bakeoff"
description: "Evaluate competing design options for a foundational decision with independent sub-agent designers and blind, order-rotated judges, then synthesise a hybrid."
---

# Blind design bake-off

Use this for foundational, hard-to-reverse design decisions, or whenever you already lean towards one answer and want to check it fairly. Skip it for small choices.

## 1. Frame the question neutrally
- Write a shared brief to a file: the project, what is already settled, the design goals, and the exact open question.
- Do not reveal which option you or the user prefer, or the history of the discussion.
- Choose 2 or 3 genuinely different options. Include at least one you are not inclined towards.

## 2. Independent designers
- Launch one sub-agent per option, in parallel, in the background.
- Each reads only the brief and is assigned one option.
- Each must argue the strongest case AND list honest weaknesses (at least four) with mitigations.
- Give every designer the same output structure, for example: core rule, how it works with concrete examples, interactions with existing systems, readability, weaknesses and mitigations, strongest case. Same word limit for all.

## 3. Anonymise
- Save each design to a file, stripping titles and tell-tale names.
- Label them neutrally (X/Y for two, P/Q/R for three).

## 4. Blind judges with rotated order
- Two options: two judges, each seeing them in opposite orders. Three options: three judges, rotating the order so each design appears in each position once.
- Judges read the brief and the anonymised designs only.
- Fixed criteria scored 1 to 5 with a sentence each (adapt to the question, e.g. fit with the settled design, readability and simplicity, depth, player experience, theme, cost and risk).
- Each judge also gives: totals, a recommendation with confidence, each design's biggest underplayed flaw, ideas to steal from the losers, and whether a hybrid would beat all options (with a sketch).

## 5. Synthesise and report
- De-anonymise and tabulate scores per judge and in total.
- Say whether the judges agreed, including when your own prior lean lost.
- List the bugs and flaws the judges found.
- Present the consensus hybrid, then let the user make the final call.
- Keep the report short; offer the full write-ups on request.