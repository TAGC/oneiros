/**
 * Mirrors the repo's question issues (labelled `kind:open` or `kind:conflict`, open and
 * closed) into the gitignored question cache, with each issue's blocked-by links and
 * comments (the cache keeps only the answer comment), each duplicate's canonical issue, and
 * every milestone with the question issues in it (constellations). Needs the `gh` CLI,
 * signed in.
 * Usage: bun run pull
 */
import { join } from 'node:path';
import { QUESTION_CACHE, writeQuestionCache } from '../src/lib/questions';
import { writeMilestoneCache } from '../src/lib/questions/constellations';
import { type GitHub, liveGitHub } from './github';

/** The repo's question cache. */
export const CACHE = join(import.meta.dirname, '..', QUESTION_CACHE);

/** Wipes the cache at `dir` and rewrites it from GitHub; returns what it wrote. */
export function pull(github: GitHub, dir: string): string {
  const issues = github.questions();
  const milestones = github.milestones();
  writeQuestionCache(dir, issues);
  writeMilestoneCache(dir, milestones, issues);
  return `Wrote ${issues.length} question(s) and ${milestones.length} milestone(s) to ${QUESTION_CACHE}/`;
}

if (import.meta.main) console.log(pull(liveGitHub(), CACHE));
