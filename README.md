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
- **Chinese parity:** every English page has a Chinese page with the same extension, `kind`, `area`, `navbox` and number of `[!OPEN]` and `[!CONFLICT]` callouts. Every tab in `src/data/sheet-zh/` has the same block types, header lengths, row counts and row lengths as its English tab.
- **Question markers:** every `[!ISSUE N]` marker must name an open question issue in the question cache.
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
- `.questions/`: the question cache, one Markdown file per question issue. `bun run pull` wipes and rewrites it; it is gitignored.

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
- `status: Tenet` (optional) shows how settled the page's design idea is: one of Notion, Tenet, Certainty or Dogma, from least to most settled. It uses the belief stages' rootedness ladder for the wiki's own beliefs about how the game should play; it is not a game concept. The infobox shows it as a Status row under the Area row, with the stage's painted icon; a page without an infobox shows it beside the title. Both link to `/oneiros/status/`, which explains it. That page defines each stage. Only the designer raises a status; Claude may propose one for a new page, or propose lowering one. The status page lists the full rules, and `bun run check` fails if a Certainty or Dogma page holds an open or conflict callout.
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

### Callouts

```md
> [!OPEN]
> The multiplier on [[renown]] is not yet set.

> [!CONFLICT]
> The vision says X; the Glossary says Y. The vision wins until this is settled.
```

`[!OPEN]` renders as an "Open question" note and adds the page to "Pages with open questions". `[!CONFLICT]` renders as "Conflict: vision and sheet disagree" and adds "Pages with conflicts". Every callout is listed on `/oneiros/open-questions/`. Use one callout per question so each can be linked.

### Question markers

Open questions are moving to GitHub issues labelled `kind:open` or `kind:conflict` and one `area:<area>`. A page marks where a question's box goes:

```md
> [!ISSUE 142]
```

The build fills in the box from the question cache: the header from the `kind:` label, the body from the issue's `## en` or `## zh` section for the page's language, with wiki links resolved as on pages. The `## zh` section starts with a `### ` line holding the Chinese title. Markers count like callouts on the open questions page and in the automatic categories, and inline callouts keep working beside them. Run `bun run pull` first, or the box says the question is missing.

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
