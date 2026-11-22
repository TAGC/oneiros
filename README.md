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
bun run constellations # the constellations from .questions/; `apply <plan> --live` charts them
bun run links <plan>   # the links a plan adds or removes between questions; `--live` makes them
bun run verify         # build, test, lint, format:check and check
```

In dev, a page's link colours are worked out when that page renders. If links look stale after adding a page, restart the dev server.

## Docs

The authoring guide and the rest of the reference, by topic:

- [Checks](docs/checks.md): the content checks, the git hooks and the deploy; allowing a red link or a word, banning a Chinese term.
- [Layout](docs/layout.md): where things live in the repo.
- [Pages](docs/pages.md): file names, frontmatter, the contents box, styles and figures.
- [Wiki links](docs/wiki-links.md): the `[[wiki link]]` syntax and how targets resolve.
- [Open questions](docs/open-questions.md): question issues and their labels, issue format, links, answers and status, markers, the pull and resolving questions.

## Authoring guide

#### Duplicates

When two issues ask the same question, the designer picks the canonical one and the page that keeps its marker (its Page row). Close the other issue as a duplicate of it, here #145 of #142:

```sh
gh issue close 145 --reason duplicate --duplicate-of 142
gh issue edit 145 --remove-milestone
```

Without `--duplicate-of` in your `gh`, use the GraphQL API, with each issue's `node_id` from `gh api repos/TAGC/oneiros/issues/<number> --jq .node_id`:

```sh
gh api graphql -f query='mutation($id: ID!, $of: ID!) { closeIssue(input: {issueId: $id, stateReason: DUPLICATE, duplicateIssueId: $of}) { issue { number } } }' -f id=<node_id of 145> -f of=<node_id of 142>
```

Close it once the pull request that replaces its marker (below) is merged: a marker naming a duplicate fails the checks. GitHub then shows "Duplicate of #142", and the pull reads it (`duplicateOf` in the cache). A duplicate needs no answer comment, and it leaves its constellation: remove its milestone when you close it. It is left out of the open questions page, the graph facts, constellations and the Astrolabe.

The canonical issue keeps its marker on its owner page. On the duplicate's page, its marker gives way to one plain line linking to the canonical question's box, whose anchor is `issue-<number>`. In English, "See the open question on" (or "See the conflict on") and the page:

```md
See the open question on [[Ablaze#issue-142|Ablaze]].
```

In Chinese, 见, the page and 上的待定问题 (or 上的冲突), with the Chinese page title:

```md
见[[燃烧中#issue-142|燃烧中]]上的待定问题。
```

If both markers were on the same page, remove the duplicate's marker instead. Once the canonical question is settled, its box goes, and the section links check fails on these lines until they link to the settled rule.

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
- **Reasoning:** the shared theme only, the rule, page or decision that holds the questions together. Never counts ("all four", "both", "two are conflicts") or a roll call of which question asks what, because questions close and move and the description would go stale.

An issue's milestone is its constellation, so an issue sits in at most one. Every open question should sit in one; a one-question milestone is fine. Closed questions stay in their milestone and count as settled, except a duplicate, which leaves it when closed. A constellation is **finished** when its milestone is closed or every question in it is closed (agreed by the designer on 22 Nov 2026). A finished constellation stops showing as open at once, everywhere (the open questions page, the Astrolabe's Dial, its list and its clusters), without waiting for its milestone to close; still close the milestone, as below. An open milestone with no questions is not finished. An open question in no open constellation is ungrouped, including a reopened question in a finished one. On the Astrolabe, clustered by constellation, a settled question that shows keeps its finished constellation, drawn faint, with no facts line and outside the time and energy filter. The pull fetches closed milestones too, so finished constellations keep their questions.

Code reads constellations only through `src/lib/questions/constellations.ts`; the finished rule is `isFinished` there. `bun run check` checks each open, unfinished constellation's description (see Checks); finished ones are not checked.

The `chart-constellations` skill keeps the constellations sound: it assigns new questions, splits or merges groups and closes finished ones. `bun run constellations` prints the current chart; `bun run constellations apply <plan>` shows the milestone changes a plan file needs, and `--live` makes them with `gh api`.

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
