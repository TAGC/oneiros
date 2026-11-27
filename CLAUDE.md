# Oneiros wiki

Oneiros is a just-for-fun game design: a systemic RPG in the spirit of Caves of Qud, set in the Dreamlands and grounded in Philipp Mainländer's philosophy, where players' real dream journals become shareable places (Reveries). It may never be built; the design itself is the point.

This repo is the design's wiki and the **single source of truth** for settled design: https://tagc.github.io/oneiros/ (English) and `/zh/` (Simplified Chinese). Open questions, conflicts and their answers live in this repo's GitHub issues, which are the source of truth for them. Claude writes and maintains the pages and issues; the designer reads, reviews and decides.

## Repo map

- `src/content/wiki/`: English pages, one per Glossary term (`kind: term`) plus overview pages (`kind: system`). `docs/` (indexed in `README.md`) is the authoring guide (frontmatter, `[[wiki links]]`, callouts, `<SheetTable>`, navboxes, icons, Chinese pages, checks): follow it.
- `src/content/wiki-zh/`: Chinese pages, paired with the English page by file name.
- `src/data/sheet/` and `src/data/sheet-zh/`: tabular data (the old reference sheet's tabs), rendered with `<SheetTable>`.
- `src/data/navboxes.json`, `src/data/icons.json`: navboxes per area; 24×24 pixel icons, now only the fallback. Painted area icons: masters in `art-src/icons/`, built into `public/icons/` by `bun run icons`.
- `src/i18n/ui.ts`: interface strings (en, zh). `src/i18n/zh-terms.md`: the adopted Chinese term list.
- `.questions/`: gitignored cache of the question issues, written by `bun run pull`; read it only through `src/lib/questions/`.
- `src/lib/`: the 16 areas (`areas.ts`), wiki link resolver, backlinks, callouts, render cache digest. `src/pages/[...locale]/`: routes for both languages.

## Commands

`bun run dev`, `bun run build` (about 10 s), `bun run lint`, `bun run format:check`, `bun run check` (content checks and cspell, after a build), `bun run verify` (all of them). Run `verify` before committing content. Pushing to `main` deploys to GitHub Pages; the deploy runs the same checks.

## Content rules

- **Never invent design.** Only what the designer explicitly agreed is a decision. Claude's suggestions are suggestions: say so, and never write them into a page as settled.
- **Flag, don't settle.** Anything unconfirmed, ambiguous or open becomes a question issue (`kind:open`); contradictions between sources become `kind:conflict` issues. Put its `[!ISSUE N]` marker on the owner page; format in `docs/open-questions.md`. The `/open-questions/` page and the Astrolabe collect them. Settle a question only when the designer decides it: post the answer on its issue and write the rule into the page itself.
- **Record decisions only when the designer asks**, and only in the wiki and its question issues (never in handoff notes or memory). Every recorded decision gets an issue with an answer comment, even with no question behind it.
- **Page status** (`status:` frontmatter; rules on the `/status/` page): never raise a page's status yourself, only propose. Tenet means the premise is accepted, to keep and refine, so Tenet pages change freely as decisions land. Ask whether a Tenet status still holds only when a change or an open question or conflict challenges the page's premise itself.
- **One owner page per rule.** State a rule fully on its owner page; elsewhere one line plus a link. Each sheet table renders on one page.
- **Tables for data, prose for decisions.**
- **Every English change is mirrored in Chinese** in the same commit series: same sections, claims and callouts, using `src/i18n/zh-terms.md` exactly. The designer delegated Chinese wording to Claude; new Chinese terms go into the term list first.
- British English, no em dashes, plain short sentences.
- The Dream seeds (the designer's real dreams) are private: never commit or publish them.

## Ubiquitous language

- The wiki's term pages are the Glossary. Read the relevant term pages before design work. Use their terms exactly as defined and spelt; never swap in synonyms or invent names for existing concepts.
- There is no `GLOSSARY.md` and no ADR folder. For domain modelling (including the `domain-modeling` skill), the term pages in `src/content/wiki/` (`kind: term`) are the glossary, and decisions live in the pages and their question issues.
- In a term's definition, link every other Glossary term it uses. Never use an undefined word as if it were a term (for example "pulse" for an outburst): define it or say it plainly.
- Capitalise tracked values and named states (Coherence, Conviction, Hold, Attention, Remembered, Lucid, the belief stages, the emotions, the sleep phases, Attention levels, Coherence status words) and proper nouns (the Dreamer, the Dreamlands, Temenos, Reverie, Oceanus). Lowercase general mechanics and things (lucidity, mood, grain, vividness, memory, bead, obol, apeiron, kyathos).
- Bold domain terms in replies to the designer.
- If the designer uses a term loosely, ambiguously, with the wrong capitalisation or differently from the wiki, point it out briefly, suggest the wiki term, then carry on. A term doesn't claim a broad ordinary word (for example "crack"); if a term is used in two senses, flag it.
- When a new concept is agreed or a term's meaning changes: update its term page (both languages), the Chinese term list, and every use.

## Settled background

- The Dreamer is a titanic, god-like being whose dream is the Dreamlands, not a mundane sleeper.
- A player's offered dream journal entry becomes a Reverie: a smaller setting inside the one shared world, not a separate world.
- Lovecraft is limited to the shared-dream concept, the world name and occasional Easter eggs. For all inspirations: borrow ideas, not names. This binds the game's ontology only: wiki pages and Glossary terms. Files in `docs/`, such as `docs/principles.md`, may use borrowed names.
- Art direction: isometric 2.5D like Hades, not top-down tiles.
- Art: new art is never drawn as code. The designer generates it (Midjourney); Claude cuts it out, cleans it up and checks it in place. Kept as code by the designer's choice: the Coherence rings figure, the logo and favicon, the Lucide icons on Quality styles, the 24×24 pixel icons as the fallback for painted area icons, the Astrolabe star map, and interface glyphs and decoration (menu and theme buttons, starfield, frame). Area icons follow the recipe in `docs/area-icons.md` (moodboards, angle, prompts, fixes, checks).

## Working style

- Keep answers short.
- To go over conflicts and open questions, follow `.claude/skills/resolve-open-questions`: one cohesive group per session, one question at a time, an answer comment on each issue, and one pull request per group that closes its issues.
- For foundational design choices, offer a blind design bake-off (`.claude/skills/blind-design-bakeoff`).
- `docs/principles.md` holds the designer's rules of thumb for reasoning about the design. Use them in design work as reasons, never as settled rules, and never name them on a wiki page. Only the designer adds or changes one.
- `.claude/skills/canon-audit` traces claims to past claude.ai chats, which Claude Code cannot search: ask the designer to check the chat links or paste excerpts. The first audit (21 Nov 2026) covered memory and memory light; its open findings are open questions on their pages. Everything else is unaudited.
- Ideas the designer parks for later go on the Parked topics page, one section and one question issue each.
- In quality-of-the-will reviews, commit each quality's agreed changes before moving to the next.

## Git

- Conventional Commits, small and atomic, one concern each; never one large mixed commit.
- Parallel agents work in their own worktrees and commit there without pushing; the lead cherry-picks onto `main`, runs `verify`, pushes, then removes the worktrees. Deleting branches is left to the designer (a hook blocks `git branch -D`).
- Push over HTTPS (the `gh` credential helper). Commit signing is off for this repo.
