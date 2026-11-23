# Checks

`bun run check` reads the built site, so run `bun run build` first (or use `bun run verify`, which does both). The deploy workflow runs `lint`, `knip`, `depcruise`, `format:check` and `check` after the build, and a failure stops the deploy. On a pull request to `main`, the check workflow (`.github/workflows/check.yml`) pulls the questions and runs `bun run verify`.

Git hooks run the same checks earlier. Set them up once per clone with `pre-commit install` (needs [pre-commit](https://pre-commit.com)); `.pre-commit-config.yaml` defines them.

- **On commit:** oxfmt formats staged code, oxlint runs, and cspell checks staged pages, sheet data, the README and `docs/`.
- **On the commit message:** commitlint requires a Conventional Commit (`commitlint.config.js`).
- **On push:** `bun run verify`, the deploy's checks.

- **Spelling** (cspell, British English): the English pages, the README, `docs/` and the English sheet data. Code, URLs, HTML tags, hex colours, frontmatter keys and Chinese text are skipped. American spellings in `cspell-american.txt` are flagged.
- **Section links:** every internal link in `dist/` must reach an existing page, and its `#fragment` an existing `id` on that page.
- **Red links:** a link to a missing page fails unless its slug is in `src/data/redlinks.json`. Both languages share the list. The check also fails when a listed page has been written or nothing links to it any more.
- **English style:** no em dashes, and no spaced en dashes used as dashes, in the English pages, sheet data, README or `docs/`.
- **Chinese parity:** every English page has a Chinese page with the same extension, `kind`, `area` and `navbox`, and the same `[!ISSUE N]` markers. Every tab in `src/data/sheet-zh/` has the same block types, header lengths, row counts and row lengths as its English tab.
- **Questions:** checked against the question cache.
  - Every `[!ISSUE N]` marker names an open question issue.
  - No page holds an inline `[!OPEN]` or `[!CONFLICT]` callout.
  - No page spells a marker any other way than `> [!ISSUE N]` alone in a top-level quote, such as `> [!issue #12]` or a marker in a nested quote; the failure shows the right spelling. Code blocks are skipped.
  - An issue's Page row matches the page that holds its marker.
  - Every issue has a section for each site locale, and its `## zh` section has the Chinese title.
  - Every Undermined by row names a question issue, and so does every blocked-by link: an issue with neither `kind:` label is not a question.
  - No blocked-by links form a cycle, whatever the state of its questions; the failure names every question in the cycle.
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

## Code

- **Unused code** (`bun run knip`, configured in `knip.json`): files nothing imports, unused exports and unused or missing dependencies. Entry points are the Astro pages and config (found by knip's Astro plugin), `scripts/*.ts`, the test files, and the infobox figures in `src/components/figures/`, which `Infobox.astro` loads by name through `import.meta.glob`. An exported type or interface that its own module uses is allowed, since it names part of that module's interface. `@commitlint/cli` is listed as used, since only the commit-msg hook runs it. Delete dead code, or drop the `export` from a value only its own module uses; list a new entry point in `knip.json` only when something loads it without an import.
- **Module rules** (`bun run depcruise`, configured in `.dependency-cruiser.cjs`): the import rules below. They see only run-time imports: an `import type` is erased before anything runs, so it breaks no rule.
  - No circular imports.
  - Every import resolves (Astro's virtual `astro:` modules aside).
  - Only `scripts/github.ts` imports `node:child_process`, since it is the only way to GitHub. `src/lib/pages.ts` may too: it runs `git log` for the pages' edit dates.
  - Domain modules (`src/lib/` and the Astrolabe's `.ts` modules) do not import the interface strings, `src/i18n/ui.ts`; pages and components pass them the strings they need. The modules that render localised text themselves are listed by name in the config, each with its reason. Keep that list from growing.
  - Nothing the Astrolabe's browser code imports (`start.ts` and everything it reaches: the `*client*.ts` modules and `state*.ts`) reaches the questions module, the interface strings or a Node built-in, since none of them runs in a browser.

  No rule can see a path written as a string, so the rule that only the questions module reads the question cache stays a review rule ([coding standards](../CODING_STANDARDS.md)).
