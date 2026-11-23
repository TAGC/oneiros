# Coding standards

Judgement calls a reviewer applies to a diff. Mechanical rules live in the checks (`docs/checks.md`: oxlint, oxfmt, knip, dependency-cruiser and the content checks); this file holds only what no check decides. Content rules (design, pages, questions, Chinese) are in `CLAUDE.md`.

## Tests

- **Test through a module's interface.** A test calls what the module exports, the way its callers do, not its internals. The scripts that change GitHub run end to end against `scripts/github-fake.ts`, which keeps the GitHub module's calls in memory.

## One source per concept

- **One home for each concept**, which every caller uses: one frontmatter parser (`src/lib/frontmatter.ts`), one fallback to English (`inLocale` in `src/i18n/locale.ts`), one cluster list (`clusterList` in `src/lib/questions/clusters.ts`). Reuse it rather than writing a second.
- **Derived facts are computed, never stored twice.** A question's status comes from GitHub's state, and every graph fact from `questionGraph()`. Store the input and derive the rest where it is read.

## Questions and GitHub

- **The question cache only through the questions module.** Only `src/lib/questions/` (and its tests) reads or writes `.questions/`; everything else asks the module.
- **Every GitHub call through the GitHub module** (`scripts/github.ts`). It names each call and sends every text as a JSON request body (`gh api --input -`), never on the command line.
- **Dry run by default.** A script that changes GitHub or the pages prints what it would change, and acts only with `--live`. A live run that changes GitHub ends with a pull, so the cache matches GitHub.

## Text

- **Interface strings in both languages.** Every string a page shows lives in `src/i18n/ui.ts`, in English and Chinese, with Chinese terms from `src/i18n/zh-terms.md`.
- **British English, no em dashes**, in code comments, messages and docs as in the pages.
