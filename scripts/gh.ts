/** The `gh` CLI, for the scripts that read and write this repo's issues and milestones. */
import { execFileSync } from 'node:child_process';
import { REPO } from '../src/lib/site';

/** This repo as `owner/name`. */
export const SLUG = new URL(REPO).pathname.slice(1);

/** Runs `gh api` with these arguments and returns its output, trimmed. */
export function gh(args: string[], input?: string): string {
  return execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}
