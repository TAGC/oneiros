# Open questions

Open questions and conflicts live in GitHub issues on this repo, one issue per question. The issues hold the question text, the links between questions and the answers. The wiki holds the settled rules and a marker where each open question's box goes. `/oneiros/open-questions/` lists them all.

The open questions page groups the questions by constellation. Open questions in no open constellation come last, under "Not in a constellation": page by page, then those that no page marks, such as decision issues, under "Not on a page", by area.

## Labels

- `kind:open` or `kind:conflict`: the question's kind. It is stored only here.
- `area:<area>`: exactly one per issue, the lowercase name of one of the 16 areas in `src/lib/areas.ts`, such as `area:memory`.

## Issue format

The issue title is the English title. The body has an English property table, an English Context section and one section per site locale, keyed by locale code:

```md
| Property | Value |
|---|---|
| Page | [Ablaze](https://tagc.github.io/oneiros/ablaze/) |
| Section | While Ablaze |
| Source | Vision |
| Raised | 21 Nov 2026, <session or chat link> |
| Related | #139, #145 |
| Undermined by | #208 |

## Context

<free-form English prose>

## en

<question text, as the callout reads today>

## zh

### <Chinese title>

<question text in Chinese>
```

- **Page:** the page that holds the marker. Required when the question has a marker; every other row is optional.
- **Section:** the section of that page.
- **Source:** where the question comes from, as a comma-separated list. On a conflict, each source must be a wiki link to a page, such as `[[Memory]]`, or a name from the fixed list of non-page sources kept in code with both languages (`vision`, `sheet`). The box header is built from it: `vision, sheet` gives "Conflict: vision and sheet disagree", and three sources read "A, B and C disagree". A page source shows its title in the page's language. A conflict needs at least two sources (a check fails otherwise).
- **Raised:** when and where the question was raised.
- **Related:** issues worth reading alongside, not blockers.
- **Undermined by:** on a decided issue, the later issue that broke its premise.
- **Context:** the discussion that led to the question, in any form.
- **Locale sections:** `## en` holds the question as the box shows it. `## zh` starts with a `### ` line holding the Chinese title, then the Chinese text. Wiki links work in both.

One question blocks another through GitHub's own "blocked by" link (the issue's Relationships menu), not a property row. From the command line, `gh api -X POST repos/TAGC/oneiros/issues/<blocked>/dependencies/blocked_by -F issue_id=<id>` takes the blocking issue's `id` from `gh api repos/TAGC/oneiros/issues/<number> --jq .id`, not its number.

To change many links at once, write a plan and run `bun run links <plan>`. Each line adds or removes one link, with an optional reason after a colon:

```question-links
add #145 blocked-by #142: #145 asks how fast vividness fades, so #142 must first say whether it fades.
add #139 related #142: both ask about fading on Memory.
remove #142 undermined-by #208: #208 left its premise standing.
```

A Related link goes on both issues' rows; an Undermined by row only on the first issue. In a Markdown file, only `question-links` code blocks count. The helper prints the changes and makes them only with `--live`. The `link-questions` skill proposes such plans.

## Answers and status

The answer is one comment on the issue, posted while the pull request that lands it is open:

```md
## Answer

### en

<the decision in English>

### zh

<the decision in Chinese>

Decided by the designer, 22 Nov 2026, in <session or chat link>. Confidence: Tenet (bare yes). Accepted Claude's proposal. Lands in #210.
```

The last line is the provenance: who decided, when, in which session, and the pull request that lands it. Other comments are discussion and are ignored. If several comments start with `## Answer`, the last one counts.

Status is derived from GitHub, never stored:

| Status      | On GitHub                                                 |
| ----------- | --------------------------------------------------------- |
| Open        | Open                                                      |
| Decided     | Closed as completed, with an answer comment               |
| Ruled out   | Closed as not planned, with an answer comment             |
| Undermined  | Decided, with an Undermined by row                        |
| Duplicate   | Closed as a duplicate of another question issue           |

## The question graph

`questionGraph()` in `src/lib/questions/graph.ts` derives every fact that depends on the links between questions; nothing else derives them. It returns plain data: one record per question, the threads and the cycles. Duplicates are left out. When the questions are loaded, every blocked-by, Undermined by and Related link to a duplicate becomes a link to its canonical question, following a chain of duplicates, and repeats are dropped. A link to a duplicate whose canonical question is not in the cache stays as it is. The designer agreed these rules on 22 Nov 2026.

- **Settled blocker:** a blocker that is decided or ruled out. Every other blocker is unsettled: an open question, an undermined decision (its premise is broken), or an issue missing from the cache (unknown).
- **Place:** where a question stands. **Frontier:** open, and every blocker is settled, so it is ready to ask. **Blocked:** open, and waiting on at least one unsettled blocker. **Settled:** closed, whether decided, ruled out or undermined. An undermined question's place is settled, yet as a blocker it is unsettled.
- **Steps out:** the longest chain of unsettled blockers in front of an open question. A frontier question is 0 steps out. Waiting only on frontier questions, undermined decisions or unknown issues is 1 step out, and each open blocker further back in the chain adds one. A settled question is 0. The Astrolabe's tiers give one, two, and three or more steps out a column each.
- **Dependents:** the open questions a question directly blocks.
- **Roles**, of open questions: **central** blocks at least `CENTRAL_MIN_DEPENDENTS` (3) open questions directly; **peripheral** is on the frontier, and no open question waits on it; **independent** has no links at all to or from any question in the graph, Related rows included. An independent question is always peripheral too.
- **Thread kinds:** a blocked-by link runs from blocker to blocked, **settled** when the blocker is settled and **unsettled** otherwise. An **undermines** thread runs from a question to the decision whose premise it broke, from that decision's Undermined by row. The Astrolabe draws the threads.
- **Cycles:** blocked-by links that lead back to where they started, whatever the state of their questions, including a question blocked by itself. `bun run check` fails on each cycle and names its questions. Until the cycle is broken, every open question in it counts as blocked, and its steps out, and those of every question waiting on it, are capped at the number of open questions, so the build never hangs.

## Markers

A page marks where an open question's box goes:

```md
> [!ISSUE 142]
```

The build fills in the box from the question cache: the header from the `kind:` label (and the Source row for a conflict), the body from the section for the page's language, with wiki links resolved as on pages. The English and Chinese pages carry the same markers. Run `bun run pull` first, or the box says the question is missing.

Only this spelling counts: `> [!ISSUE N]`, alone in a quote of its own at the top level of the page. `bun run check` fails on any other spelling, such as `> [!issue #12]`, on a marker with more text in its quote, and on a marker inside another quote or a list, and it shows the right spelling. A marker inside a code block is only code.

`src/lib/questions/markers.ts` finds the markers. It reads the parsed Markdown, not the raw text, and takes each line number from there. Rendering, the page list, the Open questions page and the checks all use it.

Inline `[!OPEN]` and `[!CONFLICT]` callouts are the old form, and `bun run check` fails on them. Write every question as an issue with a marker.

## The pull

`bun run pull` fetches every issue labelled `kind:open` or `kind:conflict`, open and closed, with their blocked-by links and answer comments, each duplicate's canonical issue, and every milestone. It wipes `.questions/` and writes one Markdown file per issue: the structured facts in frontmatter, the text below. Each milestone goes to `.questions/milestones/<number>.md`, with the question issues in it in frontmatter and its description below. The cache is gitignored. The deploy pulls before every build. Editing, labelling, linking or closing an issue, setting or removing its milestone, and creating, editing, closing, reopening or deleting a milestone all redeploy the site. Locally, pull again after changing issues or milestones.

## Resolving questions

- One pull request per resolved group of questions. It replaces each marker with the rule as plain prose in both languages, and its body says `Closes #N` once for each decided issue, so merging closes the issues and lands the pages together.
- Post each answer comment while the pull request is open. If the pull request is dropped, the issue stays open with only a draft answer.
- Every decision the designer asks to record gets an issue, even with no question behind it: open it, answer it and close it in the same pull request.
- A ruled-out question gets its answer comment, and the pull request removes its marker. Close the issue as not planned (`gh issue close N --reason "not planned"`) once the pull request is merged: a marker naming a closed issue fails the checks.
- Commit bodies say which issues they close; the answer comments hold the provenance.
- Once every question in a constellation is closed, close its milestone (`gh api -X PATCH repos/TAGC/oneiros/milestones/<number> -f state=closed`).

The `resolve-open-questions` skill walks through a session.

The question workflow borrows ideas from [rengwu/wayfinder-maps](https://github.com/rengwu/wayfinder-maps) (MIT): questions as tickets, blocked-by edges, derived status, the frontier, undermined decisions and its GitHub pull script. Ideas are borrowed, not code.
