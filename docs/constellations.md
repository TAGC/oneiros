# Constellations

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
- **Reasoning:** the shared theme only, the rule, page or decision that holds the questions together. Never counts ("all four", "both", "two are conflicts") or a roll call of which question asks what, because questions close and move and the description would go stale. The plan helper warns when reasoning looks like it states counts; `bun run check` does not fail on it.

An issue's milestone is its constellation, so an issue sits in at most one. Every open question should sit in one; a one-question milestone is fine. Closed questions stay in their milestone and count as settled, except a duplicate, which leaves it when closed. A constellation is **finished** when its milestone is closed or every question in it is closed (agreed by the designer on 22 Nov 2026). A finished constellation stops showing as open at once, everywhere (the open questions page, the Astrolabe's Dial, its list and its clusters), without waiting for its milestone to close; still close the milestone, as below. An open milestone with no questions is not finished. An open question in no open constellation is ungrouped, including a reopened question in a finished one. On the Astrolabe, clustered by constellation, a settled question that shows keeps its finished constellation, drawn faint, with no facts line and outside the time and energy filter. The pull fetches closed milestones too, so finished constellations keep their questions.

The format above has one owner, `src/lib/questions/constellation-format.ts`: it writes a constellation's title and description, reads them back and validates them (Size and Energy on their scales, a name and reasoning in each language). Its tests prove that reading a written constellation gives the same constellation. Code reads constellations only through `src/lib/questions/constellations.ts`, which reads the cache through the format module; the finished rule is `isFinished` there. `bun run check` checks each open, unfinished constellation's description with the format module's rules (see [Checks](checks.md)); finished ones are not checked.

The `chart-constellations` skill keeps the constellations sound: it assigns new questions, splits or merges groups and closes finished ones. `bun run constellations` prints the current chart; `bun run constellations apply <plan>` checks the plan with the same format rules and shows the milestone changes it needs, and `--live` makes them, then pulls. The helper loads milestones only through the constellations module and changes them only through the GitHub module (`scripts/github.ts`), which sends titles and descriptions as a JSON request body (`gh api --input -`), never on the command line, so Chinese text is safe.

## Clusters

A **clustering** is a way to gather the questions: by **areas** or by **constellations**. A **cluster** is one group in a clustering. Each holds its kind, its identity (an area or a milestone number), its name in the page's language (or English), and its questions with their open and total counts. The kinds:

- **area:** the questions of one area.
- **constellation:** an open constellation's questions, open and settled.
- **finished:** a finished constellation's settled questions.
- **none:** the rest: the questions of no area, or in no constellation.

Every question sits in exactly one cluster of each clustering. By constellation, a question sits in its open constellation; else, if settled, in its finished constellation; else in none. So a question reopened in a finished constellation sits in none. Duplicates sit in no cluster. Agreed by the designer on 22 Nov 2026.

The clusters come in one order. By area: the wiki's areas, then "No area". By constellation: the open constellations, then "In no constellation", then the finished constellations, each by milestone number. Empty clusters are left out.

The cluster list, `clusterList` in `src/lib/questions/clusters.ts`, is the one place that decides membership and order. The Astrolabe's night sky and tiers lay it out. The open questions page reads the clustering by constellation, keeps only the open questions and drops the clusters left empty: the open constellations, then "Not in a constellation".
