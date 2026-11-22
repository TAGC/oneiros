/**
 * Applies an approved links plan to the question issues: blocked-by links through GitHub's
 * issue dependencies, Related and Undermined by rows by editing each issue body's property
 * table. Dry run by default: it reads the issues and prints what it would change. A live run
 * ends by pulling, so the question cache matches GitHub.
 * Plan lines are `add|remove #N blocked-by|related|undermined-by #M: <reason>`; in a Markdown
 * file only `question-links` code blocks count. Needs the `gh` CLI, signed in.
 * Usage: bun run links <plan file> [--live]
 */
import { readFileSync } from 'node:fs';
import { type LinkedIssue, parsePlan, planChanges } from '../src/lib/questions/links';
import { type GitHub, liveGitHub } from './github';
import { CACHE, pull } from './pull';

export interface RunOptions {
  live: boolean;
  /** The question cache a live run refreshes. */
  cache: string;
  log: (line: string) => void;
  /** Warnings and errors; `log` when absent. */
  warn?: (line: string) => void;
}

/** Applies a links plan's text: prints the changes, and makes them when live. */
export function applyLinks(github: GitHub, plan: string, { live, cache, log }: RunOptions): void {
  const changes = parsePlan(plan);
  const numbers = [...new Set(changes.flatMap((c) => [c.issue, c.other]))].sort((a, b) => a - b);
  const issues = new Map<number, LinkedIssue>();
  for (const n of numbers) {
    const issue = github.question(n);
    issues.set(n, {
      body: issue.body ?? '',
      blockedBy: (issue.blockedBy ?? []).map((b) => b.number),
    });
  }

  const planned = planChanges(changes, issues);
  const verb = live ? '' : 'would ';
  for (const { issue, before, after } of planned.bodies) {
    const was = new Set(before.split(/\r?\n/));
    const now = new Set(after.split(/\r?\n/));
    log(`#${issue}: ${verb}edit the property table`);
    for (const line of was) if (!now.has(line)) log(`  - ${line}`);
    for (const line of now) if (!was.has(line)) log(`  + ${line}`);
    if (live) github.editIssueBody(issue, after);
  }
  for (const { issue, blocker } of planned.block) {
    log(`#${issue}: ${verb}add blocked by #${blocker}`);
    if (live) github.addBlockedBy(issue, blocker);
  }
  for (const { issue, blocker } of planned.unblock) {
    log(`#${issue}: ${verb}remove blocked by #${blocker}`);
    if (live) github.removeBlockedBy(issue, blocker);
  }
  for (const line of planned.skipped) log(`skipped: ${line}`);
  const total = planned.bodies.length + planned.block.length + planned.unblock.length;
  if (!live) {
    log(`Dry run: ${total} change(s). Add --live to make them.`);
    return;
  }
  log(`Applied ${total} change(s).`);
  log(pull(github, cache));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: bun run links <plan file> [--live]');
    process.exit(1);
  }
  applyLinks(liveGitHub(), readFileSync(file, 'utf8'), {
    live: args.includes('--live'),
    cache: CACHE,
    log: console.log,
  });
}
