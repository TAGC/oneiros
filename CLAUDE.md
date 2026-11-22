# Oneiros wiki

Oneiros is a just-for-fun game design: a systemic RPG in the spirit of Caves of Qud, set in the Dreamlands and grounded in Philipp Mainländer's philosophy, where players' real dream journals become shareable places (Reveries). It may never be built; the design itself is the point.

This repo is the design's wiki and its **single source of truth**: https://tagc.github.io/oneiros/ (English) and `/zh/` (Simplified Chinese). Claude writes and maintains the pages; the designer reads, reviews and decides.

## Repo map

- `src/content/wiki/`: English pages, one per Glossary term (`kind: term`) plus overview pages (`kind: system`). `README.md` (repo root) is the authoring guide (frontmatter, `[[wiki links]]`, callouts, `<SheetTable>`, navboxes, icons, Chinese pages, checks): follow it.
- `src/content/wiki-zh/`: Chinese pages, paired with the English page by file name.
- `src/data/sheet/` and `src/data/sheet-zh/`: tabular data (the old reference sheet's tabs), rendered with `<SheetTable>`. `glossary.json` defines the 16 areas.
- `src/data/navboxes.json`, `src/data/icons.json`: navboxes per area; 24×24 pixel icons, now only the fallback. Painted area icons: masters in `art-src/icons/`, built into `public/icons/` by `bun run icons`.
- `src/i18n/ui.ts`: interface strings (en, zh). `src/i18n/zh-terms.md`: the adopted Chinese term list.
- `src/lib/`: wiki link resolver, backlinks, callouts, render cache digest. `src/pages/[...locale]/`: routes for both languages.

## Commands

`bun run dev`, `bun run build` (about 10 s), `bun run lint`, `bun run format:check`, `bun run check` (content checks and cspell, after a build), `bun run verify` (all of them). Run `verify` before committing content. Pushing to `main` deploys to GitHub Pages; the deploy runs the same checks.

## Content rules

- **Never invent design.** Only what the designer explicitly agreed is a decision. Claude's suggestions are suggestions: say so, and never write them into a page as settled.
- **Flag, don't settle.** Anything unconfirmed, ambiguous or open gets a `> [!OPEN]` callout on its owner page; contradictions between sources get `> [!CONFLICT]`. The `/open-questions/` page collects them. Resolve a callout only when the designer decides it, and record the outcome in the page itself.
- **Record decisions only when the designer asks**, and only in the wiki (never in handoff notes or memory).
- **Page status** (`status:` frontmatter; rules on the `/status/` page): never raise a page's status yourself, only propose. When you add a `[!CONFLICT]` or a core `[!OPEN]` to a Tenet page, or change a page's core rule, ask the designer whether its status still holds.
- **One owner page per rule.** State a rule fully on its owner page; elsewhere one line plus a link. Each sheet table renders on one page.
- **Tables for data, prose for decisions.**
- **Every English change is mirrored in Chinese** in the same commit series: same sections, claims and callouts, using `src/i18n/zh-terms.md` exactly. The designer delegated Chinese wording to Claude; new Chinese terms go into the term list first.
- British English, no em dashes, plain short sentences.
- The Dream seeds (the designer's real dreams) are private: never commit or publish them.

## Ubiquitous language

- The wiki's term pages are the Glossary. Use their terms exactly as defined; never swap in synonyms or invent names for existing concepts.
- Capitalise tracked values and named states (Coherence, Conviction, Hold, Attention, Remembered, Lucid, the belief stages, the emotions, the sleep phases, Attention levels, Coherence status words) and proper nouns (the Dreamer, the Dreamlands, Temenos, Reverie, Oceanus). Lowercase general mechanics and things (lucidity, mood, grain, vividness, memory, bead, obol, apeiron, kyathos).
- Bold domain terms in replies to the designer.
- If the designer uses a term loosely, ambiguously, with the wrong capitalisation or differently from the wiki, point it out briefly, suggest the wiki term, then carry on. A term doesn't claim a broad ordinary word (for example "crack"); if a term is used in two senses, flag it.
- When a new concept is agreed or a term's meaning changes: update its term page (both languages), the Chinese term list, and every use.

## Settled background

- The Dreamer is a titanic, god-like being whose dream is the Dreamlands, not a mundane sleeper.
- A player's offered dream journal entry becomes a Reverie: a smaller setting inside the one shared world, not a separate world.
- Lovecraft is limited to the shared-dream concept, the world name and occasional Easter eggs. For all inspirations: borrow ideas, not names.
- Art direction: isometric 2.5D like Hades, not top-down tiles.
- Art: new art is never drawn as code. The designer generates it (Midjourney); Claude cuts it out, cleans it up and checks it in place. Kept as code by the designer's choice: the Coherence rings figure, the logo and favicon, the Lucide icons on Quality styles, the 24×24 pixel icons as the fallback for painted area icons, and interface glyphs and decoration (menu and theme buttons, starfield, frame). Area icons follow the recipe in `README.md` under "Area icons" (moodboards, angle, prompts, fixes, checks).

## Working style

- Keep answers short.
- For foundational design choices, offer a blind design bake-off (`.claude/skills/blind-design-bakeoff`).
- `.claude/skills/canon-audit` traces claims to past claude.ai chats, which Claude Code cannot search: ask the designer to check the chat links or paste excerpts. The first audit (21 Nov 2026) covered memory and memory light; its open findings are `[!OPEN]` callouts on their pages. Everything else is unaudited.
- Ideas the designer parks for later go on the Parked topics page, one section and one `[!OPEN]` each.
- In quality-of-the-will reviews, commit each quality's agreed changes before moving to the next.

## Git

- Conventional Commits, small and atomic, one concern each; never one large mixed commit.
- Parallel agents work in their own worktrees and commit there without pushing; the lead cherry-picks onto `main`, runs `verify`, pushes, then removes the worktrees. Deleting branches is left to the designer (a hook blocks `git branch -D`).
- Push over HTTPS (the `gh` credential helper). Commit signing is off for this repo.
