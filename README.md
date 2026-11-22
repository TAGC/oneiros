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
- [Duplicates](docs/duplicates.md): closing a duplicate question issue and replacing its marker.
- [Constellations](docs/constellations.md): the milestone format, the Size and Energy scales, membership and when one is finished.
- [Sheet tables and navboxes](docs/sheet-tables-and-navboxes.md): `<SheetTable>` in MDX pages and the navbox file.
- [Area icons](docs/area-icons.md): the painted area and belief icons: files, moodboards, prompts, fixes and checks.

## Authoring guide

### Chinese pages

English is the default and keeps its URLs. Chinese lives under `/oneiros/zh/`, mirroring every English route, and the header switches between the two.

- **Files.** A Chinese page goes in `src/content/wiki-zh/` with the same file name as the English page (`src/content/wiki-zh/coherence.md` pairs with `src/content/wiki/coherence.md`) and is served at `/oneiros/zh/wiki/coherence/`. The frontmatter is the same; write `title`, `summary`, `aliases`, infobox labels and values in Chinese, but keep `area`, `kind`, `categories` and `navbox` as the English values.
- **Links.** `[[Target]]` matches Chinese titles and aliases first, then English ones, so `[[Echo|回响]]` always works and `[[回响]]` works once a Chinese page has that title or alias. A target with a Chinese page links there; one with only an English page links to the English page with a small "EN" mark; one with neither is red.
- **Lists.** Chinese indexes, category pages and open questions list the Chinese version of each page where there is one, and the English page (marked "EN") where there is not. "What links here" counts Chinese pages only.
- **Navboxes.** Add `titleZh` to a navbox or `labelZh` to a group to translate it; without them the English text is shown. Links follow the rules above.
- **Sheet tables.** Chinese pages show the English data with an "English data" note. A translated tab in `src/data/sheet-zh/<tab>.json` (same shape as `src/data/sheet/`) is picked up automatically.
- **Interface strings** are in `src/i18n/ui.ts`, including the Chinese area names and site name. All Chinese domain terms come from the adopted term list, `src/i18n/zh-terms.md`; use them exactly.
- **Typography.** No italics in Chinese: `*emphasis*` shows dots under the characters, so prefer `**bold**` for strong emphasis. Put full-width punctuation outside the `**`, as in `**梦境世界**：`, or the bold will not close.
