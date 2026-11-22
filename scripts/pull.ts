/**
 * Mirrors the repo's question issues (labelled `kind:open` or `kind:conflict`, open and
 * closed) into the gitignored question cache, with each issue's blocked-by links and
 * comments (the cache keeps only the answer comment), each duplicate's canonical issue, and
 * every milestone with the question issues in it (constellations). Needs the `gh` CLI,
 * signed in.
 * Usage: bun run pull
 */
import { join } from 'node:path';
import {
  type GithubIssue,
  type PulledIssue,
  QUESTION_CACHE,
  writeQuestionCache,
} from '../src/lib/questions';
import {
  type GithubMilestone,
  type MilestonedIssue,
  writeMilestoneCache,
} from '../src/lib/questions/constellations';
import { gh, SLUG } from './gh';

const ROOT = join(import.meta.dirname, '..');
const KIND_LABELS = ['kind:open', 'kind:conflict'];

/** Every item of a paginated list endpoint. */
function list<T>(path: string): T[] {
  return gh(['--paginate', '--jq', '.[]', path])
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

const DUPLICATE_OF = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { duplicateOf { number repository { nameWithOwner } } }
  }
}`;

/**
 * The issue a duplicate was closed as a duplicate of, in this repo. REST's
 * `marked_as_duplicate` timeline event does not name it, and GraphQL's
 * `MarkedAsDuplicateEvent` swaps its canonical and duplicate sides, so this reads
 * `Issue.duplicateOf`.
 */
function duplicateOf(number: number): number | undefined {
  const [owner, name] = SLUG.split('/');
  const out = gh([
    'graphql',
    '-f',
    `query=${DUPLICATE_OF}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `name=${name}`,
    '-F',
    `number=${number}`,
  ]);
  type Target = { number: number; repository: { nameWithOwner: string } } | null;
  const target = (JSON.parse(out) as { data: { repository: { issue: { duplicateOf: Target } } } })
    .data.repository.issue.duplicateOf;
  return target && target.repository.nameWithOwner.toLowerCase() === SLUG.toLowerCase()
    ? target.number
    : undefined;
}

const byNumber = new Map<number, GithubIssue & MilestonedIssue>();
for (const label of KIND_LABELS) {
  const path = `repos/${SLUG}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100`;
  for (const issue of list<GithubIssue & MilestonedIssue>(path)) byNumber.set(issue.number, issue);
}

const issues: (PulledIssue & MilestonedIssue)[] = [...byNumber.values()]
  .filter((i) => !i.pull_request)
  .map((issue) => ({
    ...issue,
    blockedBy: list<GithubIssue>(
      `repos/${SLUG}/issues/${issue.number}/dependencies/blocked_by?per_page=100`,
    ),
    issueComments: issue.comments
      ? list<{ body: string | null }>(`repos/${SLUG}/issues/${issue.number}/comments?per_page=100`)
      : [],
    ...(issue.state_reason === 'duplicate' && { duplicateOf: duplicateOf(issue.number) }),
  }));
const milestones = list<GithubMilestone>(`repos/${SLUG}/milestones?state=all&per_page=100`);
writeQuestionCache(join(ROOT, QUESTION_CACHE), issues);
writeMilestoneCache(join(ROOT, QUESTION_CACHE), milestones, issues);
console.log(
  `Wrote ${issues.length} question(s) and ${milestones.length} milestone(s) to ${QUESTION_CACHE}/`,
);
