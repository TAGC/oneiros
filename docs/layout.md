# Layout

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
- `scripts/github.ts`: the GitHub module, the only way the scripts reach GitHub. It names every call (read the questions and milestones, edit an issue body, link, close, set milestones) and sends every text as a JSON request body (`gh api --input -`), never on the command line. `scripts/github-fake.ts` keeps the same calls in memory, so tests run the links, constellations and duplicate commands end to end.
- `.questions/`: the question cache, one Markdown file per question issue, and one per milestone under `.questions/milestones/`. `bun run pull` wipes and rewrites it; it is gitignored.
- `src/astrolabe/`: the Astrolabe, the star map of every question at `/astrolabe/`. Self-contained, with [its own README](../src/astrolabe/README.md); only a thin route sits in `src/pages/`.
