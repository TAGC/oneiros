/**
 * Mirrors the repo's question issues (labelled `kind:open` or `kind:conflict`, open and
 * closed) into the gitignored question cache, with each issue's blocked-by links and
 * comments (the cache keeps only the answer comment), and every milestone with the question
 * issues in it (constellations). Needs the `gh` CLI, signed in.
 * Usage: bun run pull
 */
import { execFileSync } from 'node:child_process';
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
import { REPO } from '../src/lib/site';

const ROOT = join(import.meta.dirname, '..');
const SLUG = new URL(REPO).pathname.slice(1);
const KIND_LABELS = ['kind:open', 'kind:conflict'];

/** Every item of a paginated list endpoint. */
function list<T>(path: string): T[] {
  const out = execFileSync('gh', ['api', '--paginate', '--jq', '.[]', path], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
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
  }));
const milestones = list<GithubMilestone>(`repos/${SLUG}/milestones?state=all&per_page=100`);
writeQuestionCache(join(ROOT, QUESTION_CACHE), issues);
writeMilestoneCache(join(ROOT, QUESTION_CACHE), milestones, issues);
console.log(
  `Wrote ${issues.length} question(s) and ${milestones.length} milestone(s) to ${QUESTION_CACHE}/`,
);
