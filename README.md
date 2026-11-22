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
```

In dev, a page's link colours are worked out when that page renders. If links look stale after adding a page, restart the dev server.

## Layout

- `src/content/wiki/`: the pages, one Markdown (or MDX) file each.
- `src/content/wiki-zh/`: Chinese versions of pages, named after the English page's file.
- `src/i18n/ui.ts`: interface strings in English and Chinese.
- `src/data/sheet/`: the reference sheet's tabs as JSON. Do not edit by hand.
- `src/data/navboxes.json`: navboxes.
- `src/data/icons.json`: 24×24 pixel icons for the Memory, Beliefs, Temenos and Magic areas.
- `src/components/figures/`: SVG figures for infoboxes.
- `src/lib/`: the wiki link resolver, remark plugin and page helpers.

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

### Contents box and backlinks

A page with three or more `##` headings gets a collapsible contents box before the first one. "What links here", the navbox and the categories footer are added automatically.

### Styles you can use

- Markdown tables render as wiki tables; numeric cells right-align.
- `<p class="formula">…</p>` for a formula.
- `<ul class="status"><li>Anchored</li>…</ul>` for a row of named states.

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

### Chinese pages

English is the default and keeps its URLs. Chinese lives under `/oneiros/zh/`, mirroring every English route, and the header switches between the two.

- **Files.** A Chinese page goes in `src/content/wiki-zh/` with the same file name as the English page (`src/content/wiki-zh/coherence.md` pairs with `src/content/wiki/coherence.md`) and is served at `/oneiros/zh/wiki/coherence/`. The frontmatter is the same; write `title`, `summary`, `aliases`, infobox labels and values in Chinese, but keep `area`, `kind`, `categories` and `navbox` as the English values.
- **Links.** `[[Target]]` matches Chinese titles and aliases first, then English ones, so `[[Echo|回响]]` always works and `[[回响]]` works once a Chinese page has that title or alias. A target with a Chinese page links there; one with only an English page links to the English page with a small "EN" mark; one with neither is red.
- **Lists.** Chinese indexes, category pages and open questions list the Chinese version of each page where there is one, and the English page (marked "EN") where there is not. "What links here" counts Chinese pages only.
- **Navboxes.** Add `titleZh` to a navbox or `labelZh` to a group to translate it; without them the English text is shown. Links follow the rules above.
- **Sheet tables.** Chinese pages show the English data with an "English data" note. A translated tab in `src/data/sheet-zh/<tab>.json` (same shape as `src/data/sheet/`) is picked up automatically.
- **Interface strings** are in `src/i18n/ui.ts`. Area names, "Vision" and the site name stay in English until the approved term list is in.
- **Typography.** No italics in Chinese: `*emphasis*` shows dots under the characters, so prefer `**bold**` for strong emphasis. Put full-width punctuation outside the `**`, as in `**梦境世界**：`, or the bold will not close.
