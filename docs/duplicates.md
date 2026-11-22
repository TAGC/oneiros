# Duplicates

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
