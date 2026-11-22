# The Astrolabe

The Astrolabe is the wiki's star map of every question, at `/astrolabe/` and `/zh/astrolabe/`. Each question issue is a star, labelled with its title in the page's language and clustered by area. Threads run from blocker to blocked question, and from a question to the decision whose premise it broke. Selecting a star opens a panel with its question, context, answer and links.

It is inspired by [rengwu/wayfinder-maps](https://github.com/rengwu/wayfinder-maps) (MIT): questions as tickets, blocked-by edges, derived status, the frontier and undermined decisions. Ideas are borrowed, not code. The page footer carries the same credit.

## What it shows

| Mark | Meaning |
| --- | --- |
| Gold rayed star | Frontier: open, and every blocker is settled (decided or ruled out) |
| Hollow ring | Blocked: open, and waiting on a question that is not settled |
| Solid disc | Decided: closed as completed |
| Dashed disc, struck through | Ruled out: closed as not planned |
| Disc in a broken ring | Undermined: decided, with an Undermined by row |
| Red, turned 45 degrees | A conflict between sources |
| Larger star | Central: blocks at least `CENTRAL_MIN_DEPENDENTS` open questions |
| Small moon | Peripheral: on the frontier, and no open question waits on it |
| Dotted orbit | Independent: no links at all (always peripheral too, so it shows the orbit only) |
| Gold thread with an arrow | Blocked by an open question |
| Faint dashed thread | Blocked by a closed question |
| Dotted violet thread | Broke the premise of a decision |
| Thin lines between ringed stars | One constellation |
| Small warning triangle | An open question in no constellation |

Two views share the panel, switched by buttons above the map; the choice is remembered in the browser:

- **Night sky** (the main view): a free sky in which each area gathers into its own soft glow.
- **Tiers**: columns from settled ground through the frontier to one, two, and three or more steps out; rows are the areas. A step out is the longest chain of unsettled blockers in front of a question.

## Constellations

A constellation is a group of related open questions sized for one session. The night sky joins its stars with lines and writes its name, size, energy and progress (how many of its questions are settled) beside them; a **Constellations** switch above the map shows or hides them. Under the map, a list gives every open constellation with its reasoning and questions, then the open questions that no constellation holds yet. Those ungrouped questions also carry a small warning mark in both views while constellations are shown. A star's panel names its constellation.

The time and energy filter keeps lit only the constellations that fit: a constellation fits when its size is at most the time chosen and its energy at most the energy chosen. One without a size or energy fits only "Any". Reading the filter as "the most I have" is Claude's suggestion, not a decision.

Each constellation is a GitHub milestone on this repo. Its title is `✦ ` followed by the English name; milestones without the mark are ignored. The description holds an English property table, then one section per site locale:

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

- **Size:** `small`, `medium` or `large`, ignoring case.
- **Energy:** `low`, `medium` or `high`, ignoring case.
- An issue's milestone is its constellation. Closed questions stay in it and count as settled; closed milestones are not drawn.

The Astrolabe reads constellations only through `src/lib/questions/constellations.ts` (`getConstellations()`). The repo README's "Constellations" section is the full reference.

## How it is built

Everything is laid out at build time and written as static SVG, so positions are the same on every visit and the map shows without JavaScript. Client code only adds interaction.

| File | Role |
| --- | --- |
| `chart.ts` | Shapes questions from the questions module into stars, threads and area groups for one locale. |
| `sky.ts` | The night sky layout: areas seated so linked areas sit side by side, a seeded force layout settled before the page is written, and label placement. |
| `tiers.ts` | The tiers layout. |
| `text.ts` | Rough text widths and line wrapping for English and Chinese, since no fonts are measured at build time. |
| `Astrolabe.astro` | The page, inside the wiki layout. The route in `src/pages/[...locale]/astrolabe.astro` only renders it. |
| `Sky.astro`, `Tiers.astro` | The two views. |
| `Backdrop.astro`, `backdrop.ts` | The night sky's decoration: specks, the engraved dial and the area glows, in their own SVG layer behind the map. The specks are merged into a few paths (`backdrop.ts`). |
| `Glyph.astro` | A star's glyph, shared by the views, the panel and the key. |
| `Panels.astro` | One panel per star. Without JavaScript, `:target` shows the panel a star links to. |
| `ConstellationFilter.astro` | The constellations switch and the time and energy filter, in the bar above the map. |
| `ConstellationList.astro` | The constellations and ungrouped questions under the map. |
| `StarLink.astro`, `facts.ts` | A link that opens a star's panel; a constellation's facts on one line. |
| `Legend.astro` | The key under the map. |
| `SharedDefs.astro` | Gradients and arrowheads both views use. |
| `client.ts`, `viewbox.ts` | The view switch, the star panel, thread highlighting, and pan and zoom on the sky. `viewbox.ts` holds the pan and zoom arithmetic. |
| `tints.ts` | Each area's glow colour, from the eight emotion colours. |
| `astrolabe.css` | Styles, on the wiki's tokens, for light and dark. |

The Astrolabe reads question data only through the questions module: `getQuestions()` and `questionGraph()` from `src/lib/questions`, and `getConstellations()`. Which questions appear is decided in one place, `chartQuestions` in `chart.ts`: duplicates (`isDuplicate`) stay off the map. Interface strings live under `astrolabe` in `src/i18n/ui.ts`, in both languages; the Chinese name, 星盘, is that one string. Its Chinese terms are in `src/i18n/zh-terms.md`.

The layout logic is tested with `bun test` (`chart.test.ts`, `sky.test.ts`, `tiers.test.ts`, `backdrop.test.ts`, `viewbox.test.ts`); the page itself is checked by eye in the dev server.

## Keeping it fast

The night sky is one large SVG, so every repaint redraws all of it. A few rules keep pan, zoom and the idle twinkle cheap:

- Draw many small decorative marks as a few paths, not one element each.
- Animate the decoration only in its own layer (`.al-sky-back`), never in the map above it.
- Fade paths that span the sky with `fill-opacity`, not `opacity`: opacity composites a layer as large as the path.
- Pan and zoom write the view box at most once per frame and never read the SVG's screen matrix in an event handler.
- The twinkle pauses while the sky is dragged or zoomed.

## Art

The designer ruled the Astrolabe interface decoration, so it is drawn as code: the star glyphs, threads, the area glows, the specks and the engraved dial. The sky's decoration stays in `Backdrop.astro` all the same, so it is easy to find and change.
