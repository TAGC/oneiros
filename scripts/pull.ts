/**
 * Mirrors the repo's question issues (labelled `kind:open` or `kind:conflict`, open and
 * closed) into the gitignored question cache. Needs the `gh` CLI, signed in.
 * Usage: bun run pull
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { type GithubIssue, QUESTION_CACHE, writeQuestionCache } from '../src/lib/questions';
import { REPO } from '../src/lib/site';

const ROOT = join(import.meta.dirname, '..');
const SLUG = new URL(REPO).pathname.slice(1);
const KIND_LABELS = ['kind:open', 'kind:conflict'];

function fetchIssues(label: string): GithubIssue[] {
  const path = `repos/${SLUG}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100`;
  const out = execFileSync('gh', ['api', '--paginate', '--jq', '.[]', path], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GithubIssue);
}

const byNumber = new Map<number, GithubIssue>();
for (const label of KIND_LABELS) {
  for (const issue of fetchIssues(label)) byNumber.set(issue.number, issue);
}
const issues = [...byNumber.values()].filter((i) => !i.pull_request);
writeQuestionCache(join(ROOT, QUESTION_CACHE), issues);
console.log(`Wrote ${issues.length} question(s) to ${QUESTION_CACHE}/`);
