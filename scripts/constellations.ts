/**
 * Constellations from the question cache (run `bun run pull` first), for the
 * chart-constellations skill.
 * Usage:
 *   bun run constellations                     the state: constellations, ungrouped, to close
 *   bun run constellations plan                the current chart as a plan file (YAML)
 *   bun run constellations apply <plan>        dry run: the operations the plan needs
 *   bun run constellations apply <plan> --live carry them out on GitHub with `gh api`
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadQuestions, QUESTION_CACHE } from '../src/lib/questions';
import {
  chartOperations,
  currentChart,
  loadMilestones,
  type Operation,
  type Plan,
  stateReport,
} from '../src/lib/questions/chart';
import { loadConstellations } from '../src/lib/questions/constellations';
import { REPO } from '../src/lib/site';

const CACHE = join(import.meta.dirname, '..', QUESTION_CACHE);
const SLUG = new URL(REPO).pathname.slice(1);

const questions = loadQuestions(CACHE);
const constellations = loadConstellations(CACHE, questions);
const [command = 'state', file, flag] = process.argv.slice(2);

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

function gh(args: string[]): string {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8' }).trim();
}

function run(operations: Operation[]): void {
  const created = new Map<string, number>();
  for (const op of operations) {
    if (op.kind === 'create') {
      const number = gh([
        '-X',
        'POST',
        `repos/${SLUG}/milestones`,
        '-f',
        `title=${op.title}`,
        '-f',
        `description=${op.description}`,
        '--jq',
        '.number',
      ]);
      created.set(op.ref, Number(number));
      console.log(`${describe(op)}: milestone ${number}`);
      continue;
    }
    if (op.kind === 'edit') {
      const fields = [
        ...(op.title === undefined ? [] : ['-f', `title=${op.title}`]),
        ...(op.description === undefined ? [] : ['-f', `description=${op.description}`]),
      ];
      gh(['-X', 'PATCH', `repos/${SLUG}/milestones/${op.number}`, ...fields, '--silent']);
    } else if (op.kind === 'assign') {
      const number = typeof op.milestone === 'number' ? op.milestone : created.get(op.milestone);
      if (number === undefined) throw new Error(`no milestone created for "${op.milestone}"`);
      gh([
        '-X',
        'PATCH',
        `repos/${SLUG}/issues/${op.issue}`,
        '-F',
        `milestone=${number}`,
        '--silent',
      ]);
    } else {
      gh([
        '-X',
        'PATCH',
        `repos/${SLUG}/milestones/${op.number}`,
        '-f',
        'state=closed',
        '--silent',
      ]);
    }
    console.log(describe(op));
  }
}

if (command === 'state') {
  console.log(stateReport(questions, constellations));
} else if (command === 'plan') {
  const ungrouped = constellations.ungrouped().map((q) => q.number);
  console.log(stringifyYaml({ ...currentChart(constellations), ungrouped }).trim());
} else if (command === 'apply' && file) {
  const plan = parseYaml(readFileSync(file, 'utf8')) as Plan;
  const result = chartOperations(plan, questions, loadMilestones(CACHE));
  for (const w of result.warnings) console.warn(`warning: ${w}`);
  if (result.errors.length) {
    for (const e of result.errors) console.error(`error: ${e}`);
    process.exit(1);
  }
  if (!result.operations.length) console.log('Nothing to change.');
  else if (flag === '--live') run(result.operations);
  else {
    for (const op of result.operations) console.log(describe(op));
    console.log(`\nDry run: ${result.operations.length} operation(s). Add --live to apply them.`);
  }
} else {
  console.error('Usage: bun run constellations [state | plan | apply <plan> [--live]]');
  process.exit(1);
}
