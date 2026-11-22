/**
 * Constellations from the question cache (run `bun run pull` first), for the
 * chart-constellations skill.
 * Usage:
 *   bun run constellations                     the state: constellations, ungrouped, to close
 *   bun run constellations plan                the current chart as a plan file (YAML)
 *   bun run constellations apply <plan>        dry run: the operations the plan needs
 *   bun run constellations apply <plan> --live carry them out on GitHub with `gh api`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadQuestions, QUESTION_CACHE } from '../src/lib/questions';
import {
  chartOperations,
  currentChart,
  type Operation,
  type Plan,
  stateReport,
} from '../src/lib/questions/chart';
import { loadConstellations } from '../src/lib/questions/constellations';
import { gh, SLUG } from './gh';

const CACHE = join(import.meta.dirname, '..', QUESTION_CACHE);

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

/** Sends a JSON request body on stdin, so text of any language reaches GitHub intact. */
function send(method: string, path: string, body: object, ...args: string[]): string {
  return gh(['-X', method, `repos/${SLUG}/${path}`, '--input', '-', ...args], JSON.stringify(body));
}

function run(operations: Operation[]): void {
  const created = new Map<string, number>();
  for (const op of operations) {
    if (op.kind === 'create') {
      const { title, description } = op;
      const number = send('POST', 'milestones', { title, description }, '--jq', '.number');
      created.set(op.ref, Number(number));
      console.log(`${describe(op)}: milestone ${number}`);
      continue;
    }
    if (op.kind === 'edit') {
      const { title, description } = op;
      send('PATCH', `milestones/${op.number}`, { title, description }, '--silent');
    } else if (op.kind === 'assign') {
      const number = typeof op.milestone === 'number' ? op.milestone : created.get(op.milestone);
      if (number === undefined) throw new Error(`no milestone created for "${op.milestone}"`);
      send('PATCH', `issues/${op.issue}`, { milestone: number }, '--silent');
    } else {
      send('PATCH', `milestones/${op.number}`, { state: 'closed' }, '--silent');
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
  const result = chartOperations(plan, questions, constellations);
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
