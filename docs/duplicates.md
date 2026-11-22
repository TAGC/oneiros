# Duplicates

When two issues ask the same question, the designer picks the canonical one and the page that keeps its marker (its Page row). The other issue becomes a duplicate of it. One command does the rest, here making #145 a duplicate of #142:

```sh
bun run duplicate 142 145          # dry run: prints the page edits and GitHub changes
bun run duplicate 142 145 --live   # makes them, then pulls
```

It does three things:

- On #145's page, in English and Chinese, it swaps the marker for one line linking to #142's box (below). If both markers are on the same page, it removes #145's marker instead.
- It closes #145 as a duplicate of #142. GitHub then shows "Duplicate of #142", and the pull reads it (`duplicateOf` in the cache).
- It removes #145's milestone: a duplicate leaves its constellation.

It refuses, changing nothing, when the canonical issue is closed or has no Page row, or when the duplicate is already closed another way. It takes only the two numbers: the titles in the link lines come from the pages' files, read as UTF-8, so no text passes through the command line. Run on a pair already handled, it says there is nothing to change.

Commit the page edits in the pull request for the group. A marker naming a duplicate fails the checks, so until that pull request is merged, deploys of `main` fail on the old marker. A duplicate needs no answer comment. It is left out of the open questions page, the graph facts, constellations and the Astrolabe.

The canonical issue keeps its marker on its owner page. On the duplicate's page, the link line points to the canonical question's box, whose anchor is `issue-<number>`. In English, "See the open question on" (or "See the conflict on", when the canonical issue is a conflict) and the page:

```md
See the open question on [[Ablaze#issue-142|Ablaze]].
```

In Chinese, 见, the page and 上的待定问题 (or 上的冲突), with the Chinese page title:

```md
见[[燃烧中#issue-142|燃烧中]]上的待定问题。
```

Once the canonical question is settled, its box goes, and the section links check fails on these lines until they link to the settled rule.
