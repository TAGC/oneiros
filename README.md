# Oneiros Wiki

A just-for-fun game design project. Live at <https://tagc.github.io/oneiros/>.

Oneiros is a systemic RPG set in the Dreamlands, where players' real dream journals become places in the world. This repo is its design wiki: Markdown pages in git, built with Astro and deployed to GitHub Pages on every push to `main`.

## Running it

Needs Bun 1.4.4 and Node 26 (see `.nvmrc`).

```sh
bun install
bun run dev            # http://localhost:4321/oneiros/
bun run build          # astro check, astro build, then the Pagefind index
bun run preview        # serve dist/ (search works here, not in dev)
bun run lint           # oxlint
bun run format         # oxfmt (format:check to verify)
bun run check          # spelling and content checks (run after a build)
bun run test           # unit tests (bun test)
bun run pull           # mirror question issues into .questions/ (needs gh, signed in)
bun run verify         # build, test, lint, format:check and check
```

In dev, a page's link colours are worked out when that page renders. If links look stale after adding a page, restart the dev server.

## Checks

`bun run check` reads the built site, so run `bun run build` first (or use `bun run verify`, which does both). The deploy workflow runs lint, format:check and check after the build, and a failure stops the deploy.

Git hooks run the same checks earlier. Set them up once per clone with `pre-commit install` (needs [pre-commit](https://pre-commit.com)); `.pre-commit-config.yaml` defines them.

- **On commit:** oxfmt formats staged code, oxlint runs, and cspell checks staged pages, sheet data and this README.
- **On the commit message:** commitlint requires a Conventional Commit (`commitlint.config.js`).
- **On push:** `bun run verify`, the deploy's checks.

- **Spelling** (cspell, British English): the English pages, this README and the English sheet data. Code, URLs, HTML tags, hex colours, frontmatter keys and Chinese text are skipped. American spellings in `cspell-american.txt` are flagged.
- **Section links:** every internal link in `dist/` must reach an existing page, and its `#fragment` an existing `id` on that page.
- **Red links:** a link to a missing page fails unless its slug is in `src/data/redlinks.json`. Both languages share the list. The check also fails when a listed page has been written or nothing links to it any more.
- **English style:** no em dashes, and no spaced en dashes used as dashes, in the English pages, sheet data or README.
- **Chinese parity:** every English page has a Chinese page with the same extension, `kind`, `area` and `navbox`, and the same `[!ISSUE N]` markers. Every tab in `src/data/sheet-zh/` has the same block types, header lengths, row counts and row lengths as its English tab.
- **Questions:** checked against the question cache.
  - Every `[!ISSUE N]` marker names an open question issue.
  - No page holds an inline `[!OPEN]` or `[!CONFLICT]` callout.
  - An issue's Page row matches the page that holds its marker.
  - Every issue has a section for each site locale, and its `## zh` section has the Chinese title.
  - Every Undermined by row names a question issue, and so does every blocked-by link: an issue with neither `kind:` label is not a question.
  - A conflict's Source row names at least two sources, each a wiki link or a listed non-page source.
  - Every closed issue has an answer comment, with a section for each site locale. Duplicates need none.
  - No marker names a duplicate; the failure names the canonical issue and its page.
  - Every duplicate names its canonical issue, which is a question issue and not itself a duplicate.
  - A Certainty or Dogma page holds no marker.
  - Every open constellation's milestone has a Size and an Energy on their scales, the `## en` reasoning, and a `## zh` section with its Chinese name and reasoning.
- **Chinese terms:** superseded renderings listed in `src/i18n/zh-forbidden.json` must not appear in the Chinese pages or sheet data.

To allow a red link, add the slug and a one-line reason to `src/data/redlinks.json`:

```json
{ "damage": "Linked from the Coherence infobox; the page is not written yet." }
```

To accept a word cspell does not know, add it to `cspell-words.txt` under the right heading. Add only genuine domain words, Greek names and proper nouns; fix anything else. To ban a Chinese term, add `{ "term", "preferred", "note", "allow" }` to `src/i18n/zh-forbidden.json`, where `allow` lists longer strings that contain the term legitimately (as `做梦者` contains `梦者`).

## Layout

- `src/content/wiki/`: the pages, one Markdown (or MDX) file each.
- `src/content/wiki-zh/`: Chinese versions of pages, named after the English page's file.
- `src/i18n/ui.ts`: interface strings in English and Chinese.
- `src/data/sheet/`: the data tables, imported once from the old reference sheet. Edit them here; the spreadsheet is retired.
- `src/data/navboxes.json`: navboxes.
- `src/data/icons.json`: 24×24 pixel icons, one per area.
- `src/components/figures/`: SVG figures for infoboxes.
- `public/art/`: the background art the designer generated. Dark mode uses a night scene of the Dreamlands (made with Midjourney), graded darker and bluer for the site. Light mode uses a day scene (`dreamlands-day-*`), graded slightly softer and less saturated. The ungraded originals stay outside the repo.
- `src/components/LICENSE-lucide.txt`: the licence for the three Lucide icons on the Quality styles page.
- `src/lib/`: the wiki link resolver, remark plugin and page helpers.
- `src/lib/questions/`: the questions module, the only way into question data. It writes and reads the question cache.
- `.questions/`: the question cache, one Markdown file per question issue, and one per milestone under `.questions/milestones/`. `bun run pull` wipes and rewrites it; it is gitignored.
- `src/astrolabe/`: the Astrolabe, the star map of every question at `/astrolabe/`. Self-contained, with [its own README](src/astrolabe/README.md); only a thin route sits in `src/pages/`.

## Authoring guide

### Pages

One page per Glossary term, plus pages for the vision's systems. The file name is the kebab-case of the title: `Going under` lives in `src/content/wiki/going-under.md` and is served at `/oneiros/wiki/going-under/`.

Write in British English, with no em dashes. Use the Glossary's terms exactly and follow its capitalisation. Write only what the vision and the Glossary say; never invent design.

### Frontmatter

```yaml
---
title: Coherence # required; the page name
kind: term # required; term (one Glossary term) or system (a vision system page)
area: Character # required; one of the Glossary's Area values
summary: Health, how well a will keeps its own motion. # required; one sentence
aliases: [Echoes] # optional; plurals and other names that link here
categories: [Tracked values] # optional; extra categories
infobox: # optional
  figure: CoherenceRings # optional; a component in src/components/figures/
  caption: A will keeping its own motion # optional
  rows:
    - label: At zero
      value: You return as an [[Echo]] # inline Markdown; wiki links work
navbox: character # optional; an id in src/data/navboxes.json
---
```

- `summary` feeds hover previews, the Glossary index, category pages and search. Keep it to one plain sentence.
- `area` is also a category. The infobox's Area row is added automatically.
- `icon: Lore` (optional) shows that key of `src/data/icons.json` beside the title instead of the area's icon.
- `status: Tenet` (optional) shows how settled the page's design idea is: one of Notion, Tenet, Certainty or Dogma, from least to most settled. It uses the belief stages' rootedness ladder for the wiki's own beliefs about how the game should play; it is not a game concept. The infobox shows it as a Status row under the Area row, with the stage's painted icon; a page without an infobox shows it beside the title. Both link to `/oneiros/status/`, which explains it. That page defines each stage. Only the designer raises a status; Claude may propose one for a new page, or propose lowering one. The status page lists the full rules, and `bun run check` fails if a Certainty or Dogma page holds a question marker.
- Quote YAML values that start with `[[` or contain `: `.

### Wiki links

| Syntax                     | Links to                                   |
| -------------------------- | ------------------------------------------ |
| `[[Echo]]`                 | the Echo page, shown as "Echo"             |
| `[[Memory\|memories]]`     | the Memory page, shown as "memories"       |
| `[[Coherence#At zero]]`    | a section of the Coherence page            |
| `[[Coherence#At zero\|x]]` | that section, shown as "x"                 |
| `[[#Coherence status]]`    | a section of the current page              |

(The `\|` above is only escaped because it sits in a table; write a plain `|` in prose. Inside a Markdown table, escape it as `\|`.)

Targets match titles and aliases, ignoring case. A link to a page that does not exist yet shows red and points at the page's would-be URL. When the page is written, it turns blue. Prefer linking the canonical title with a label (`[[Belief|beliefs]]`) until the target page exists, then add plurals as aliases.

Links inside raw HTML (such as `<p class="formula">`) are not processed.

### Open questions

Open questions and conflicts live in GitHub issues on this repo, one issue per question. The issues hold the question text, the links between questions and the answers. The wiki holds the settled rules and a marker where each open question's box goes. `/oneiros/open-questions/` lists them all.

#### Labels

- `kind:open` or `kind:conflict`: the question's kind. It is stored only here.
- `area:<area>`: exactly one per issue, the lowercase name of one of the 16 areas in `src/lib/areas.ts`, such as `area:memory`.

#### Issue format

The issue title is the English title. The body has an English property table, an English Context section and one section per site locale, keyed by locale code:

```md
| Property | Value |
|---|---|
| Page | [Ablaze](https://tagc.github.io/oneiros/ablaze/) |
| Section | While Ablaze |
| Source | Vision |
| Raised | 21 Nov 2026, <session or chat link> |
| Related | #139, #145 |
| Undermined by | #208 |

## Context

<free-form English prose>

## en

<question text, as the callout reads today>

## zh

### <Chinese title>

<question text in Chinese>
```

- **Page:** the page that holds the marker. Required when the question has a marker; every other row is optional.
- **Section:** the section of that page.
- **Source:** where the question comes from, as a comma-separated list. On a conflict, each source must be a wiki link to a page, such as `[[Memory]]`, or a name from the fixed list of non-page sources kept in code with both languages (`vision`, `sheet`). The box header is built from it: `vision, sheet` gives "Conflict: vision and sheet disagree", and three sources read "A, B and C disagree". A page source shows its title in the page's language. A conflict needs at least two sources (a check fails otherwise).
- **Raised:** when and where the question was raised.
- **Related:** issues worth reading alongside, not blockers.
- **Undermined by:** on a decided issue, the later issue that broke its premise.
- **Context:** the discussion that led to the question, in any form.
- **Locale sections:** `## en` holds the question as the box shows it. `## zh` starts with a `### ` line holding the Chinese title, then the Chinese text. Wiki links work in both.

One question blocks another through GitHub's own "blocked by" link (the issue's Relationships menu), not a property row. From the command line, `gh api -X POST repos/TAGC/oneiros/issues/<blocked>/dependencies/blocked_by -F issue_id=<id>` takes the blocking issue's `id` from `gh api repos/TAGC/oneiros/issues/<number> --jq .id`, not its number.

#### Answers and status

The answer is one comment on the issue, posted while the pull request that lands it is open:

```md
## Answer

### en

<the decision in English>

### zh

<the decision in Chinese>

Decided by the designer, 22 Nov 2026, in <session or chat link>. Confidence: Tenet (bare yes). Accepted Claude's proposal. Lands in #210.
```

The last line is the provenance: who decided, when, in which session, and the pull request that lands it. Other comments are discussion and are ignored. If several comments start with `## Answer`, the last one counts.

Status is derived from GitHub, never stored:

| Status      | On GitHub                                                 |
| ----------- | --------------------------------------------------------- |
| Open        | Open                                                      |
| Decided     | Closed as completed, with an answer comment               |
| Ruled out   | Closed as not planned, with an answer comment             |
| Undermined  | Decided, with an Undermined by row                        |
| Duplicate   | Closed as a duplicate of another question issue           |

#### Markers

A page marks where an open question's box goes:

```md
> [!ISSUE 142]
```

The build fills in the box from the question cache: the header from the `kind:` label (and the Source row for a conflict), the body from the section for the page's language, with wiki links resolved as on pages. The English and Chinese pages carry the same markers. Run `bun run pull` first, or the box says the question is missing.

Inline `[!OPEN]` and `[!CONFLICT]` callouts are the old form, and `bun run check` fails on them. Write every question as an issue with a marker.

#### Duplicates

When two issues ask the same question, the designer picks the canonical one and the page that keeps its marker (its Page row). Close the other issue as a duplicate of it, here #145 of #142:

```sh
gh issue close 145 --reason duplicate --duplicate-of 142
```

Without `--duplicate-of` in your `gh`, use the GraphQL API, with each issue's `node_id` from `gh api repos/TAGC/oneiros/issues/<number> --jq .node_id`:

```sh
gh api graphql -f query='mutation($id: ID!, $of: ID!) { closeIssue(input: {issueId: $id, stateReason: DUPLICATE, duplicateIssueId: $of}) { issue { number } } }' -f id=<node_id of 145> -f of=<node_id of 142>
```

Close it once the pull request that replaces its marker (below) is merged: a marker naming a duplicate fails the checks. GitHub then shows "Duplicate of #142", and the pull reads it (`duplicateOf` in the cache). A duplicate needs no answer comment. It is left out of the open questions page, the graph facts, constellations and the Astrolabe.

The canonical issue keeps its marker on its owner page. On the duplicate's page, its marker gives way to one plain line linking to the canonical question's box, whose anchor is `issue-<number>`. In English, "See the open question on" (or "See the conflict on") and the page:

```md
See the open question on [[Ablaze#issue-142|Ablaze]].
```

In Chinese, 见, the page and 上的待定问题 (or 上的冲突), with the Chinese page title:

```md
见[[燃烧中#issue-142|燃烧中]]上的待定问题。
```

If both markers were on the same page, remove the duplicate's marker instead. Once the canonical question is settled, its box goes, and the section links check fails on these lines until they link to the settled rule.

The open questions page groups the questions by constellation. Open questions in no open constellation come last, under "Not in a constellation": page by page, then those that no page marks, such as decision issues, under "Not on a page", by area.

#### The pull

`bun run pull` fetches every issue labelled `kind:open` or `kind:conflict`, open and closed, with their blocked-by links and answer comments, each duplicate's canonical issue, and every milestone. It wipes `.questions/` and writes one Markdown file per issue: the structured facts in frontmatter, the text below. Each milestone goes to `.questions/milestones/<number>.md`, with the question issues in it in frontmatter and its description below. The cache is gitignored. The deploy pulls before every build. Editing, labelling, linking or closing an issue, setting or removing its milestone, and creating, editing, closing, reopening or deleting a milestone all redeploy the site. Locally, pull again after changing issues or milestones.

#### Constellations

A constellation is a group of related open questions sized for one session. Each one is a GitHub milestone on this repo whose title is `✦ ` followed by the English name. Milestones without the mark are not constellations and are ignored. Due dates are not used.

The description holds an English property table, then one section per site locale:

```md
| Property | Value |
|---|---|
| Size | Small |
| Energy | Low |

## en

<why these questions belong together>

## zh

### <Chinese name>

<the reasoning in Chinese>
```

- **Size:** `small`, `medium` or `large`, ignoring case. Size is time: how many questions and how much reading. Small is one or two questions, under 30 minutes; large is six or more, a long session.
- **Energy:** `low`, `medium` or `high`, ignoring case. Energy is weight: how hard and far-reaching the decisions are. Low is peripheral or independent questions, mostly confirming wording; high is central questions, foundations, conflicts or philosophy.
- The two are independent: eight wording fixes are large but low energy; one central question about a premise is small but high energy.
- Both scales' labels are in `src/i18n/ui.ts`, in both languages.

An issue's milestone is its constellation, so an issue sits in at most one. Every open question should sit in one; a one-question milestone is fine. Closed questions stay in their milestone and count as settled. Close the milestone once all its questions are closed; closed constellations are not shown. An open question in no open constellation is ungrouped.

Code reads constellations only through `src/lib/questions/constellations.ts`. `bun run check` checks each open constellation's description (see Checks).

#### Resolving questions

- One pull request per resolved group of questions. It replaces each marker with the rule as plain prose in both languages, and its body says `Closes #N` once for each decided issue, so merging closes the issues and lands the pages together.
- Post each answer comment while the pull request is open. If the pull request is dropped, the issue stays open with only a draft answer.
- Every decision the designer asks to record gets an issue, even with no question behind it: open it, answer it and close it in the same pull request.
- A ruled-out question gets its answer comment, and the pull request removes its marker. Close the issue as not planned (`gh issue close N --reason "not planned"`) once the pull request is merged: a marker naming a closed issue fails the checks.
- Commit bodies say which issues they close; the answer comments hold the provenance.
- Once every question in a constellation is closed, close its milestone (`gh api -X PATCH repos/TAGC/oneiros/milestones/<number> -f state=closed`).

The `resolve-open-questions` skill walks through a session.

The question workflow borrows ideas from [rengwu/wayfinder-maps](https://github.com/rengwu/wayfinder-maps) (MIT): questions as tickets, blocked-by edges, derived status, the frontier, undermined decisions and its GitHub pull script. Ideas are borrowed, not code.

### Contents box and backlinks

A page with three or more `##` headings gets a collapsible contents box before the first one. "What links here", the navbox and the categories footer are added automatically.

### Styles you can use

- Markdown tables render as wiki tables; numeric cells right-align.
- `<p class="formula">…</p>` for a formula.
- `<ul class="status"><li>Noticed</li>…</ul>` for a row of named states, as neutral pills.
- `<ul class="status status-coherence"><li>Anchored</li>…</ul>` only for the four Coherence status words, in order: adds dots from gold (whole) to violet (breaking).

### Sheet tables (MDX only)

In a `.mdx` page, render a block of a sheet tab:

```mdx
<SheetTable tab="emotions" block={0} />
```

`tab` is a file name in `src/data/sheet/` without `.json`; `block` is the block's index (default 0). Every tab is also browsable at `/oneiros/tables/`.

### Navboxes

`src/data/navboxes.json`:

```json
{
  "character": {
    "title": "Character",
    "groups": [{ "label": "Health", "links": ["Coherence", "Echo", "Renown"] }]
  }
}
```

Links are page titles and resolve like wiki links. Set `navbox: character` on each page in the group.

### Figures

An infobox figure is an Astro component in `src/components/figures/` containing one SVG, named in PascalCase (`CoherenceRings.astro` is `figure: CoherenceRings`).

### Area icons

The area icons are painted to match the background art. The designer generates them in Midjourney; Claude cuts them out and checks them in the frame. All 16 are approved (22 Nov 2026) and shown on the site. The 24×24 pixel icons in `src/data/icons.json` remain as the fallback for any name without a painted icon.

**Files.** Each area's master is the approved Midjourney image, kept as lossless WebP in `art-src/icons/<area>.webp` (not deployed). `bun run icons` cuts out the background and writes `public/icons/<area>-512` and `-128` as WebP and AVIF. To add or replace an icon, save its master there and run `bun run icons`; the site paints every area with a built file.

| Area       | Subject                                                    | Main colour                 |
| ---------- | ---------------------------------------------------------- | --------------------------- |
| Items      | Amphora with a teal band                                   | Terracotta                  |
| Library    | Upright book with copper corners                           | Teal                        |
| Beliefs    | Lit candle in a brass holder                               | Deep red                    |
| Temenos    | Small marble house with two columns and a lit doorway      | Warm ivory                  |
| Memory     | Glass orb of swirling light on a dark stand                | Gold                        |
| Rest       | Crescent moon of glossy carved stone                       | Cyan blue                   |
| Lore       | Rolled papyrus scroll tied with a cord                     | Parchment, violet cord      |
| Economy    | Cluster of glowing white obols on a knotted cord           | Pearl white                 |
| Dreams     | Feather quill in an inkwell of glowing ink                 | Violet                      |
| Lucidity   | Clear faceted crystal                                      | Clear white                 |
| Body       | Open hand on a round cuff                                  | Warm bronze                 |
| Magic      | Round palette with eight paint dabs in the emotion colours | Pale grey stone, eight dabs |
| Philosophy | Hourglass with a bleached wood frame and glowing sand      | Pale wood, blue             |
| Emotion    | Shallow bowl of still water with a soft white glow         | Pale gold, white glow       |
| World      | Floating shard of land with a tiny temple and a cypress    | Green and grey              |
| Character  | Theatre mask with a calm, neutral face                     | Porcelain white, blue       |

**Belief icons.** Five icons show the four belief stages and the Musing state. They are not area icons but follow this recipe. Their masters sit in `art-src/icons/` and `bun run icons` builds them the same way. `status:` in a page's frontmatter uses the four stage icons; Belief stages shows all five.

| Stage     | Subject                                          | Main colour     |
| --------- | ------------------------------------------------ | --------------- |
| Notion    | Loose parchment leaf                             | Warm cream      |
| Musing    | Sheaf of three pages tied with a red ribbon      | Warm cream, red |
| Tenet     | Closed book with a leather strap                 | Tan leather     |
| Certainty | Thick book with a buckle clasp                   | Crimson         |
| Dogma     | Massive book with bronze boards and a round seal | Bronze          |

**Moodboards.** Keep two. "Oneiros Scenes" holds the background scenes and is for scenes only: it pulls icons towards isometric angles, scenery and a pixel texture. "Oneiros Icons" holds only approved icons; add each new one once it passes. Midjourney applies moodboards through personalisation, so its switch stays on; select only Oneiros Icons and no profile.

**Settings.** Set the aspect ratio to 1:1 in Midjourney's settings panel once; it stays set, so prompts need no `--ar`.

**Rules for every icon.**

- Angle: seen slightly from above (about 20 degrees), upright, centred, turned slightly. No diagonal tilt, no strict isometric. A lying object such as the scroll may sit diagonally.
- Style: stylised 2D cel shading with glossy highlights, dark shaded contours, strong contrast and a thick dark outline, as in the amphora. No rim light or blue sheen.
- Shape: one object with few, chunky parts and a bold silhouette, like the book and the candle. Keep the surface rich; keep the parts few. Thin parts (many columns, fingers spread apart) blur at small sizes.
- Contrast: the frame is dark navy, so dark materials (slate, dark steel, dark wood) vanish in it. Use pale or bright versions.
- Colour: one main colour per icon, named in the prompt, so the set stays varied. Moodboard colours bleed into new icons, so state the colour and add unwanted ones to `--no`.
- Background: aim for flat black. Tinted backgrounds leave halos around glows when cut out and may cause coloured rims. Midjourney does not reliably obey it.
- Light: say "warm lamplight only" for warm subjects and leave it out for cool ones, or they turn orange. Effects without an object (beams, flashes) failed: solid with the moodboard, photographic without it.

**Prompt.** Run with the Oneiros Icons moodboard on and describe only what is unique to the icon in the first part:

```text
single <object>, <one distinctive detail>, <main colour> <material>, chunky proportions, few parts, RPG inventory icon, slight high angle view, upright, centred, turned slightly, no diagonal tilt, stylized 2d cel-shaded illustration, glossy highlights, dark shaded contours, strong contrast, thick dark outline, warm lamplight only, flat pure black background --no pixel art, pixelated, rim light, isometric, scenery, shadow
```

The words "simple shapes, minimal ornament" flattened the rendering and are not used. A style reference to the amphora (`--sref` with its image) gave richer rendering than the moodboard alone.

**Fixing a near miss.** Use Midjourney's image edit on the chosen result rather than a fresh prompt, and say what to keep as well as what to change:

- Jagged or pixelated edges (the scenes board causes these; upscaling only enlarges them): `redraw this exact <object> as a smooth hand-painted digital illustration, clean anti-aliased edges, smooth shading, keep the same shape, colours, dark outline and warm light --no pixel art, pixelated, dithering, jagged edges`. Turn the moodboard off for this step.
- Wrong colour: `recolour this exact <object>: <colours>, keep the thick dark outline, warm lamplight, shape and lighting --no <unwanted colours>, white border`. Without the keep list, recolours turn the outline into a white sticker border and the light cold and grey. "Pale" kills a glow; ask for "bright glowing" instead.
- Wrong angle: `stand this exact <object> upright, turned slightly, slight high angle view, centred, no diagonal tilt, keep colours, outline and style`.
- Unwanted detail: `remove the <detail>, keep the <object>, shape, thick dark outline and lighting exactly the same --no <detail>`.
- Nearly right: a subtle variation can improve a detail, such as a stronger glow.

**Checking.** Claude removes the solid background, crops to a square and mocks the icon in the real frame at the tile size (up to 200px), 64px and 26px, beside the icon it replaces. An icon passes when its silhouette and main colour still read at 26px.

### Chinese pages

English is the default and keeps its URLs. Chinese lives under `/oneiros/zh/`, mirroring every English route, and the header switches between the two.

- **Files.** A Chinese page goes in `src/content/wiki-zh/` with the same file name as the English page (`src/content/wiki-zh/coherence.md` pairs with `src/content/wiki/coherence.md`) and is served at `/oneiros/zh/wiki/coherence/`. The frontmatter is the same; write `title`, `summary`, `aliases`, infobox labels and values in Chinese, but keep `area`, `kind`, `categories` and `navbox` as the English values.
- **Links.** `[[Target]]` matches Chinese titles and aliases first, then English ones, so `[[Echo|回响]]` always works and `[[回响]]` works once a Chinese page has that title or alias. A target with a Chinese page links there; one with only an English page links to the English page with a small "EN" mark; one with neither is red.
- **Lists.** Chinese indexes, category pages and open questions list the Chinese version of each page where there is one, and the English page (marked "EN") where there is not. "What links here" counts Chinese pages only.
- **Navboxes.** Add `titleZh` to a navbox or `labelZh` to a group to translate it; without them the English text is shown. Links follow the rules above.
- **Sheet tables.** Chinese pages show the English data with an "English data" note. A translated tab in `src/data/sheet-zh/<tab>.json` (same shape as `src/data/sheet/`) is picked up automatically.
- **Interface strings** are in `src/i18n/ui.ts`, including the Chinese area names and site name. All Chinese domain terms come from the adopted term list, `src/i18n/zh-terms.md`; use them exactly.
- **Typography.** No italics in Chinese: `*emphasis*` shows dots under the characters, so prefer `**bold**` for strong emphasis. Put full-width punctuation outside the `**`, as in `**梦境世界**：`, or the bold will not close.
