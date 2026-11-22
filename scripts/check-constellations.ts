/**
 * The strict constellations check, run by `bun run verify` but not by the deploy: closing an
 * issue on GitHub redeploys the site, and a stale entry must not break that deploy. Fails on
 * closed, missing or unlabelled issues, a missing Chinese name or reasoning, an issue named
 * twice and a malformed file. Lists ungrouped open questions without failing.
 * Usage: bun run check:constellations
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { getQuestions } from '../src/lib/questions';
import {
  CONSTELLATIONS_FILE,
  constellationProblems,
  getConstellations,
  type IssueLookup,
} from '../src/lib/questions/constellations';
import { REPO } from '../src/lib/site';

const ROOT = join(import.meta.dirname, '..');
const SLUG = new URL(REPO).pathname.slice(1);

/** Asks GitHub what an issue missing from the cache is; undefined when `gh` cannot say. */
const lookup: IssueLookup = (number) => {
  const run = spawnSync('gh', ['api', `repos/${SLUG}/issues/${number}`], { encoding: 'utf8' });
  if (run.error) return undefined;
  if (run.status !== 0) return /HTTP 404|HTTP 410/.test(run.stderr) ? 'missing' : undefined;
  const issue = JSON.parse(run.stdout) as { pull_request?: unknown; labels: { name: string }[] };
  if (issue.pull_request) return 'not-question';
  return issue.labels.some((l) => /^kind:(open|conflict)$/.test(l.name))
    ? undefined
    : 'not-question';
};

process.chdir(ROOT);
const questions = getQuestions();
const problems = constellationProblems(CONSTELLATIONS_FILE, questions, lookup);
console.log(`Constellations: ${problems.length ? `FAIL (${problems.length})` : 'ok'}`);
for (const p of problems) console.log(`  ${p.where}: ${p.message}`);

if (!problems.length) {
  const ungrouped = getConstellations(questions).ungrouped();
  if (ungrouped.length) {
    const list = ungrouped.map((q) => `#${q.number}`).join(', ');
    console.log(`  note: ${ungrouped.length} open question(s) in no constellation: ${list}`);
  }
}
process.exit(problems.length ? 1 : 0);
