# Checks

`bun run check` reads the built site, so run `bun run build` first (or use `bun run verify`, which does both). The deploy workflow runs lint, format:check and check after the build, and a failure stops the deploy.

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
