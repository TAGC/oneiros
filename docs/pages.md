# Pages

One page per Glossary term, plus pages for the vision's systems. The file name is the kebab-case of the title: `Going under` lives in `src/content/wiki/going-under.md` and is served at `/oneiros/wiki/going-under/`.

Write in British English, with no em dashes. Use the Glossary's terms exactly and follow its capitalisation. Write only what the vision and the Glossary say; never invent design.

## Frontmatter

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

## Contents box and backlinks

A page with three or more `##` headings gets a collapsible contents box before the first one. "What links here", the navbox and the categories footer are added automatically.

## Styles you can use

- Markdown tables render as wiki tables; numeric cells right-align.
- `<p class="formula">…</p>` for a formula.
- `<ul class="status"><li>Noticed</li>…</ul>` for a row of named states, as neutral pills.
- `<ul class="status status-coherence"><li>Anchored</li>…</ul>` only for the four Coherence status words, in order: adds dots from gold (whole) to violet (breaking).

## Figures

An infobox figure is an Astro component in `src/components/figures/` containing one SVG, named in PascalCase (`CoherenceRings.astro` is `figure: CoherenceRings`).
