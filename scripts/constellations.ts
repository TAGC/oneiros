/**
 * Constellations from the question cache (run `bun run pull` first), for the
 * chart-constellations skill. A live apply ends by pulling, so the cache matches GitHub.
 * Usage:
 *   bun run constellations                     the state: constellations, ungrouped, to close
 *   bun run constellations plan                the current chart as a plan file (YAML)
 *   bun run constellations apply <plan>        dry run: the operations the plan needs
 *   bun run constellations apply <plan> --live carry them out on GitHub
 */
import { readFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadQuestions } from '../src/lib/questions';
import {
  chartOperations,
  currentChart,
  type Operation,
  type Plan,
  stateReport,
} from '../src/lib/questions/chart';
import { loadConstellations } from '../src/lib/questions/constellations';
import { type GitHub, liveGitHub } from './github';
import { CACHE, pull } from './pull';
import type { RunOptions } from './question-links';

function describe(op: Operation): string {
  switch (op.kind) {
    case 'create':
      return `create milestone "${op.title}"`;
    case 'edit': {
      const what = [op.title && `title to "${op.title}"`, op.description && 'description'];
      return `edit milestone ${op.number}: ${what.filter(Boolean).join(' and ')}`;
    }
    case 'assign':
      return `assign #${op.issue} to milestone ${typeof op.milestone === 'number' ? op.milestone : `"${op.milestone}"`}`;
    case 'close':
      return `close milestone ${op.number}`;
  }
}

function run(github: GitHub, operations: Operation[], log: (line: string) => void): void {
  const created = new Map<string, number>();
  for (const op of operations) {
    if (op.kind === 'create') {
      const number = github.createMilestone({ title: op.title, description: op.description });
      created.set(op.ref, number);
      log(`${describe(op)}: milestone ${number}`);
      continue;
    }
    if (op.kind === 'edit') {
      github.editMilestone(op.number, { title: op.title, description: op.description });
    } else if (op.kind === 'assign') {
      const number = typeof op.milestone === 'number' ? op.milestone : created.get(op.milestone);
      if (number === undefined) throw new Error(`no milestone created for "${op.milestone}"`);
      github.assignMilestone(op.issue, number);
    } else {
      github.closeMilestone(op.number);
    }
    log(describe(op));
  }
}

/**
 * Applies a plan's YAML to the constellations in the cache: prints the operations, and
 * carries them out when live. False when the plan has errors; nothing is written then.
 */
export function applyChart(
  github: GitHub,
  planText: string,
  { live, cache, log, warn = log }: RunOptions,
): boolean {
  const questions = loadQuestions(cache);
  const plan = parseYaml(planText) as Plan;
  const result = chartOperations(plan, questions, loadConstellations(cache, questions));
  for (const w of result.warnings) warn(`warning: ${w}`);
  if (result.errors.length) {
    for (const e of result.errors) warn(`error: ${e}`);
    return false;
  }
  if (!result.operations.length) log('Nothing to change.');
  else if (live) run(github, result.operations, log);
  else {
    for (const op of result.operations) log(describe(op));
    log('');
    log(`Dry run: ${result.operations.length} operation(s). Add --live to apply them.`);
  }
  if (live) log(pull(github, cache));
  return true;
}

if (import.meta.main) {
  const [command = 'state', file, flag] = process.argv.slice(2);
  const questions = loadQuestions(CACHE);
  const constellations = loadConstellations(CACHE, questions);
  if (command === 'state') {
    console.log(stateReport(questions, constellations));
  } else if (command === 'plan') {
    const ungrouped = constellations.ungrouped().map((q) => q.number);
    console.log(stringifyYaml({ ...currentChart(constellations), ungrouped }).trim());
  } else if (command === 'apply' && file) {
    const options = { live: flag === '--live', cache: CACHE, log: console.log, warn: console.warn };
    if (!applyChart(liveGitHub(), readFileSync(file, 'utf8'), options)) process.exit(1);
  } else {
    console.error('Usage: bun run constellations [state | plan | apply <plan> [--live]]');
    process.exit(1);
  }
}
