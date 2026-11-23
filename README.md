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
bun run constellations # the constellations from .questions/: open, ungrouped, ready to close
bun run constellations:plan         # the current chart as a plan file
bun run constellations:apply <plan> # the milestone changes a plan needs; `--live` makes them
bun run links <plan>   # the links a plan adds or removes between questions; `--live` makes them
bun run duplicate:mark K D   # swap duplicate D's marker for a link to K; `--live` edits
bun run duplicate:close K D  # after the merge: close D as a duplicate of K; `--live` acts
bun run verify         # build, test, lint, format:check and check
```

Every `--live` run that changes GitHub ends by running the pull itself, so `.questions/` matches GitHub.

In dev, a page's link colours are worked out when that page renders. If links look stale after adding a page, restart the dev server.

## Docs

The authoring guide and the rest of the reference, by topic:

- [Checks](docs/checks.md): the content checks, the git hooks and the deploy; allowing a red link or a word, banning a Chinese term.
- [Layout](docs/layout.md): where things live in the repo.
- [Coding standards](CODING_STANDARDS.md): the judgement calls a reviewer makes on code that no check decides.
- [Pages](docs/pages.md): file names, frontmatter, the contents box, styles and figures.
- [Wiki links](docs/wiki-links.md): the `[[wiki link]]` syntax and how targets resolve.
- [Open questions](docs/open-questions.md): question issues and their labels, issue format, links, answers and status, markers, the pull and resolving questions.
- [Duplicates](docs/duplicates.md): closing a duplicate question issue and replacing its marker.
- [Constellations](docs/constellations.md): the milestone format, the Size and Energy scales, membership and when one is finished.
- [Sheet tables and navboxes](docs/sheet-tables-and-navboxes.md): `<SheetTable>` in MDX pages and the navbox file.
- [Area icons](docs/area-icons.md): the painted area and belief icons: files, moodboards, prompts, fixes and checks.
- [Chinese pages](docs/chinese-pages.md): files, links, lists, navboxes, sheet tables, terms and typography.
