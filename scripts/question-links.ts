/**
 * Applies an approved links plan to the question issues: blocked-by links through GitHub's
 * issue dependencies API, Related and Undermined by rows by editing each issue body's property
 * table. Dry run by default: it reads the issues and prints what it would change.
 * Plan lines are `add|remove #N blocked-by|related|undermined-by #M: <reason>`; in a Markdown
 * file only `question-links` code blocks count. Needs the `gh` CLI, signed in.
 * Usage: bun run links <plan file> [--apply]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { type LinkedIssue, parsePlan, planChanges } from '../src/lib/questions/links';
import { REPO } from '../src/lib/site';

const SLUG = new URL(REPO).pathname.slice(1);
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: bun run links <plan file> [--apply]');
  process.exit(1);
}

function gh(apiArgs: string[], input?: string): string {
  return execFileSync('gh', ['api', ...apiArgs], {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

interface RestIssue {
  id: number;
  body: string | null;
  labels: { name: string }[];
  pull_request?: unknown;
}

const changes = parsePlan(readFileSync(file, 'utf8'));
const numbers = [...new Set(changes.flatMap((c) => [c.issue, c.other]))].sort((a, b) => a - b);
const ids = new Map<number, number>();
const issues = new Map<number, LinkedIssue>();
for (const n of numbers) {
  const issue = JSON.parse(gh([`repos/${SLUG}/issues/${n}`])) as RestIssue;
  if (issue.pull_request || !issue.labels.some((l) => /^kind:(open|conflict)$/.test(l.name))) {
    throw new Error(`#${n} is not a question issue`);
  }
  const blockers = gh(['--paginate', '--jq', '.[].number', `${blockedBy(n)}?per_page=100`]);
  ids.set(n, issue.id);
  issues.set(n, {
    body: issue.body ?? '',
    blockedBy: blockers.split('\n').filter(Boolean).map(Number),
  });
}

/** GitHub's dependencies endpoint; it takes the blocking issue's `id`, not its number. */
function blockedBy(n: number): string {
  return `repos/${SLUG}/issues/${n}/dependencies/blocked_by`;
}

const planned = planChanges(changes, issues);
const verb = apply ? '' : 'would ';
for (const { issue, before, after } of planned.bodies) {
  const was = new Set(before.split(/\r?\n/));
  const now = new Set(after.split(/\r?\n/));
  console.log(`#${issue}: ${verb}edit the property table`);
  for (const line of was) if (!now.has(line)) console.log(`  - ${line}`);
  for (const line of now) if (!was.has(line)) console.log(`  + ${line}`);
  if (apply) {
    gh(
      ['-X', 'PATCH', `repos/${SLUG}/issues/${issue}`, '--input', '-'],
      JSON.stringify({ body: after }),
    );
  }
}
for (const { issue, blocker } of planned.block) {
  console.log(`#${issue}: ${verb}add blocked by #${blocker}`);
  if (apply) gh(['-X', 'POST', blockedBy(issue), '-F', `issue_id=${ids.get(blocker)}`]);
}
for (const { issue, blocker } of planned.unblock) {
  console.log(`#${issue}: ${verb}remove blocked by #${blocker}`);
  if (apply) gh(['-X', 'DELETE', `${blockedBy(issue)}/${ids.get(blocker)}`]);
}
for (const line of planned.skipped) console.log(`skipped: ${line}`);
const total = planned.bodies.length + planned.block.length + planned.unblock.length;
console.log(
  apply
    ? `Applied ${total} change(s). Run bun run pull.`
    : `Dry run: ${total} change(s). Add --apply to make them.`,
);
