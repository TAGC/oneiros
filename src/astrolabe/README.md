# The Astrolabe

The Astrolabe is the wiki's star map of every question, at `/astrolabe/` and `/zh/astrolabe/`. Each question issue is a star, labelled with its title in the page's language and clustered by area or by constellation. Threads run from blocker to blocked question, and from a question to the decision whose premise it broke. Selecting a star opens a panel with its question, context, answer and links.

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

A **Full screen** button at the top right of the map (all three views) fills the screen with the map and the controls above it, by the browser's full screen or, where there is none (an iPhone) or the browser refuses it, by covering the page. The same button or Escape leaves it; Escape first closes an open panel. It shows only with JavaScript. The designer asked for it on 22 Nov 2026.

Three views, switched by buttons above the map; the choice is remembered in the browser:

- **Night sky** (the main view): a free sky in which each area gathers into its own soft glow, or each constellation into its own patch.
- **Tiers**: columns from settled ground through the frontier to one, two, and three or more steps out; rows are the areas, or the constellations. A step out is the longest chain of unsettled blockers in front of a question.
- **Constellations**: a brass dial of the open constellations, not of single questions (see below). It shows only when there are constellations.

## Constellations

A constellation is a group of related open questions sized for one session. Under the map, a list gives every open constellation with its reasoning and questions, then the open questions that no constellation holds yet. A star's panel names its constellation.

### Cluster by Areas or Constellations

A **Cluster by** choice above the map, asked for by the designer on 22 Nov 2026, gathers the night sky and the tiers by **Areas** or by **Constellations**:

- **Areas:** the sky's clusters are the areas, each in its own glow; the tiers' rows are the areas.
- **Constellations:** the sky's stars gather by constellation, joined by lines, with the constellation's name, size, energy and progress (how many of its questions are settled) beside them. The questions in no constellation gather in one more cluster, "In no constellation". The tiers' rows are the constellations, then that one.

Both sky layouts are computed at build time on one canvas, so they are the same on every visit. Switching in the night sky animates: each star flies from its old place to its new one, setting off a moment after its neighbours, and its label, threads and constellation lines follow. With reduced motion the stars jump instead. Without JavaScript the sky and tiers show by area. The choice is remembered in the browser. The Dial is unaffected.

The time and energy filter keeps lit only the constellations that fit: a constellation fits when its size is the time chosen and its energy the energy chosen. One without a size or energy fits only "Any". The designer chose exact matches on 22 Nov 2026.

Claude's suggestions, not decisions; the designer has not ruled on them:

- **Areas is the default.** It is today's sky, and the view without JavaScript.
- **Constellation marks show only by constellation.** Constellation lines, rings and names, the warning mark on a question in no constellation, and the time and energy filter all show only in Constellations mode (and the filter in the Dial). Areas mode shows no constellation marks, so it is the plain sky by area. Area names and glows fade out in Constellations mode, since the stars leave them.

### The Dial

A brass dial, agreed with the designer on 22 November 2026. Sectors are the 16 areas, in the wiki's order clockwise from the top; rings are energy, low near the hub and high at the rim. Each open constellation is one mark:

- **Where:** in the sector of its main area, the area that holds most of its questions (open and closed); a tie goes to the area that comes first in the wiki. It sits on its energy ring, spread evenly along it within the sector. A constellation that spans areas lists them all in its panel; the dial does not place it between sectors. This rule is Claude's choice, documented here.
- **Its mark:** a brass boss with a four-point star. Its size shows the constellation's size (small, medium, large; dashed when unset). One notch round it per question; a gold notch is settled.
- **Its name** sits beside it in the page's language, placed at build time so that no name overlaps another name or mark. In a crowded sector a name may sit further off on a thin leader line.

A sector widens with the constellations it holds and never gets narrower than its area's name on the band, so an area with none keeps a short, named sector. A narrow rule at the top carries the energy scale. Both are Claude's choices for legibility. A constellation with no energy gets a dashed ring inside the low one, and one with no area a "No area" sector at the end; both appear only when needed.

Selecting a mark opens its panel: name, size, energy and progress, areas, reasoning, and its questions. A question opens its star in the night sky, or its box on its wiki page. Without JavaScript, `:target` shows the panel, as for stars. The time and energy filter dims the marks that do not fit; the Cluster by choice has nothing to do in this view and hides. On a phone the dial keeps a readable size and scrolls inside the frame. A link to `/astrolabe/#dial` opens this view. It is named the Dial (表盘), not Constellations, because Constellations already names a way to cluster.

### Milestone format

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
| `sky.ts` | The night sky layouts, by area and by constellation on one canvas: clusters seated so linked clusters sit side by side, a seeded force layout settled before the page is written, and label placement. |
| `tiers.ts` | The tiers layout, by area or by constellation. |
| `curve.ts` | A thread's path in the sky, shared by the build and the client. |
| `motion.ts` | The data the build hands the client for the flight between clusterings, and each star's progress along it. |
| `brass.ts` | The constellations dial layout: sectors, rings, marks and name placement. |
| `text.ts` | Rough text widths and line wrapping for English and Chinese, since no fonts are measured at build time. |
| `Astrolabe.astro` | The page, inside the wiki layout. The route in `src/pages/[...locale]/astrolabe.astro` only renders it. |
| `Sky.astro`, `Tiers.astro`, `Brass.astro` | The three views. The sky is drawn by area, with the layout by constellation as data; the tiers are drawn once each way. |
| `Backdrop.astro`, `backdrop.ts` | The night sky's decoration: specks, the engraved dial and the area glows, in their own SVG layer behind the map. The specks are merged into a few paths (`backdrop.ts`). |
| `Glyph.astro` | A star's glyph, shared by the views, the panel and the key. |
| `Panels.astro` | One panel per star. Without JavaScript, `:target` shows the panel a star links to. |
| `BrassPanels.astro`, `BrassKey.astro` | One panel per constellation, and how to read the dial, for the constellations view. |
| `ConstellationFilter.astro` | The Cluster by choice and the time and energy filter, in the bar above the map. |
| `ConstellationList.astro` | The constellations and ungrouped questions under the map. |
| `StarLink.astro`, `facts.ts` | A link that opens a star's panel; a constellation's facts on one line. |
| `Legend.astro` | The key under the map. |
| `SharedDefs.astro` | Gradients and arrowheads both views use. |
| `client.ts`, `viewbox.ts` | The view switch, the Cluster by choice, the star panel, thread highlighting, and pan and zoom on the sky. `viewbox.ts` holds the pan and zoom arithmetic. |
| `sky-motion.ts` | Flies the sky's stars, labels, threads and constellation lines between clusterings, writing the map once per frame. |
| `fullscreen.ts`, `fullscreen-client.ts` | The full screen button: which way the browser allows, and the button itself. |
| `brass-client.ts` | The constellations view: its panel, the filter on its marks, and star links that lead to the night sky. |
| `tints.ts` | Each area's glow colour, from the eight emotion colours. |
| `astrolabe.css`, `brass.css` | Styles, on the wiki's tokens, for light and dark; `brass.css` holds the dial's. |

The Astrolabe reads question data only through the questions module: `getQuestions()` and `questionGraph()` from `src/lib/questions`, and `getConstellations()`. Which questions appear is decided in one place, `chartQuestions` in `chart.ts`: duplicates (`isDuplicate`) stay off the map. Interface strings live under `astrolabe` in `src/i18n/ui.ts`, in both languages; the Chinese name, 星盘, is that one string. Its Chinese terms are in `src/i18n/zh-terms.md`.

The layout logic is tested with `bun test` (`chart.test.ts`, `sky.test.ts`, `tiers.test.ts`, `brass.test.ts`, `backdrop.test.ts`, `viewbox.test.ts`, `motion.test.ts`, `fullscreen.test.ts`); the page itself is checked by eye in the dev server.

## Keeping it fast

The night sky is one large SVG, so every repaint redraws all of it. A few rules keep pan, zoom and the idle twinkle cheap:

- Draw many small decorative marks as a few paths, not one element each.
- Animate the decoration only in its own layer (`.al-sky-back`), never in the map above it.
- Fade paths that span the sky with `fill-opacity`, not `opacity`: opacity composites a layer as large as the path.
- Pan and zoom write the view box at most once per frame and never read the SVG's screen matrix in an event handler.
- The twinkle pauses while the sky is dragged or zoomed, or its stars fly between clusterings.
- The flight between clusterings moves only the map, never the decoration layer, and writes it once per frame.

## Art

The designer ruled the Astrolabe interface decoration, so it is drawn as code: the star glyphs, threads, the area glows, the specks, the engraved dial and the brass instrument of the constellations view. The sky's decoration stays in `Backdrop.astro` all the same, so it is easy to find and change.
