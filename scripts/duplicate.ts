/**
 * Makes DROP a duplicate of KEEP (docs/duplicates.md), in two steps, each a dry run unless
 * `--live`:
 *   bun run duplicate:mark KEEP DROP [--live]   on DROP's page, in both languages, swap its
 *     marker for one line linking to KEEP's box (or remove it, when KEEP's marker is on the
 *     same page). Reads the question cache; never touches GitHub.
 *   bun run duplicate:close KEEP DROP [--live]  once the pull request with those edits has
 *     merged: close DROP as a duplicate of KEEP, remove its milestone, then pull. Refuses
 *     while any page still holds DROP's marker.
 * Page titles come from the page files, read as UTF-8; no text passes through argv.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { LOCALES, type Locale } from '../src/i18n/ui';
import { loadQuestions, type Question, questionFrom } from '../src/lib/questions';
import { readMarkers } from '../src/lib/questions/markers';
import { WIKI_DIRS } from '../src/lib/site';
import { issueId } from '../src/lib/wiki';
import { type GitHub, liveGitHub } from './github';
import { CACHE, pull } from './pull';
import type { RunOptions } from './question-links';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** The line that stands in for a duplicate's marker, linking to the kept question's box. */
function linkLine(locale: Locale, title: string, keep: Question): string {
  const link = `[[${title}#${issueId(keep.number)}|${title}]]`;
  const conflict = keep.kind === 'conflict';
  if (locale === 'zh') return `见${link}上的${conflict ? '冲突' : '待定问题'}。`;
  return `See the ${conflict ? 'conflict' : 'open question'} on ${link}.`;
}

/** A page file, relative to the repo root, or undefined when the page has none. */
function pageFile(root: string, locale: Locale, slug: string): string | undefined {
  return ['.md', '.mdx']
    .map((ext) => `${WIKI_DIRS[locale]}/${slug}${ext}`)
    .find((file) => existsSync(join(root, file)));
}

/** The file lines of a page's markers for one issue. */
function markerLines(raw: string, issue: number): number[] {
  const front = FRONTMATTER.exec(raw)?.[0] ?? '';
  const firstLine = front.split('\n').length;
  return readMarkers(raw.slice(front.length), firstLine)
    .markers.filter((m) => m.issue === issue)
    .map((m) => m.line);
}

interface PageEdit {
  file: string;
  line: number;
  /** The marker's replacement; undefined removes it. */
  link?: string;
  text: string;
}

/** The edit that takes DROP's marker out of a page, or undefined when it has none. */
function markerEdit(raw: string, drop: number, link?: string): Omit<PageEdit, 'file'> | undefined {
  const [line] = markerLines(raw, drop);
  if (line === undefined) return undefined;
  const lines = raw.split('\n');
  const at = line - 1;
  if (lines[at].trim() !== `> [!ISSUE ${drop}]`) {
    throw new Error(`line ${line}: the marker for #${drop} spans more than one line`);
  }
  if (link !== undefined) lines.splice(at, 1, link);
  else {
    lines.splice(at, 1);
    if (lines[at] === '' && (at === 0 || lines[at - 1] === '')) lines.splice(at, 1);
  }
  return { line, link, text: lines.join('\n') };
}

export interface DuplicateOptions extends RunOptions {
  /** The repo root the page folders sit in. */
  root: string;
}

const failer = (warn: (line: string) => void) => (message: string) => {
  warn(`error: ${message}`);
  return false;
};

const verbs = (live: boolean) => (would: string, did: string) => (live ? did : `would ${would}`);

/**
 * The page step: prints DROP's marker edits in both languages, and makes them when live. Reads
 * the question cache, never GitHub. False, with nothing changed, when the pair cannot be handled.
 */
export function duplicatePages(
  keep: number,
  drop: number,
  { live, cache, root, log, warn = log }: DuplicateOptions,
): boolean {
  const fail = failer(warn);
  if (keep === drop) return fail(`#${keep} cannot be a duplicate of itself`);
  const questions = loadQuestions(cache);
  const kept = questions.get(keep);
  const dropped = questions.get(drop);
  for (const [n, q] of [
    [keep, kept],
    [drop, dropped],
  ] as const) {
    if (!q) return fail(`#${n} is not in the question cache; run bun run pull`);
  }
  if (kept!.state !== 'open') {
    return fail(
      `#${keep} is closed, so it has no box; link the marker on #${drop}’s page to its settled rule by hand`,
    );
  }
  const home = kept!.properties.page;
  if (!home) return fail(`#${keep} has no Page row, so it has no box to link to`);
  const settled = dropped!.state !== 'open';
  if (settled && !(dropped!.status === 'duplicate' && dropped!.duplicateOf === keep)) {
    return fail(`#${drop} is closed; only an open question can become a duplicate`);
  }

  const edits: PageEdit[] = [];
  const slug = dropped!.properties.page;
  if (!slug) log(`#${drop} has no Page row, so no page holds its marker`);
  for (const locale of slug ? LOCALES : []) {
    const file = pageFile(root, locale, slug!);
    if (!file) return fail(`#${drop}’s page ${slug} has no file in ${WIKI_DIRS[locale]}`);
    let link: string | undefined;
    if (slug !== home) {
      const homeFile = pageFile(root, locale, home);
      if (!homeFile) return fail(`#${keep}’s page ${home} has no file in ${WIKI_DIRS[locale]}`);
      const front = FRONTMATTER.exec(readFileSync(join(root, homeFile), 'utf8'))?.[1] ?? '';
      const title = (parseYaml(front) as { title?: unknown } | null)?.title;
      if (typeof title !== 'string') return fail(`${homeFile} has no title`);
      link = linkLine(locale, title, kept!);
    }
    const edit = markerEdit(readFileSync(join(root, file), 'utf8'), drop, link);
    if (edit) edits.push({ file, ...edit });
    else log(`${file}: no marker for #${drop}`);
  }

  const verb = verbs(live);
  for (const edit of edits) {
    if (edit.link === undefined) {
      log(`${edit.file}:${edit.line}: ${verb('remove', 'removed')} the marker for #${drop}`);
    } else {
      const replace = verb('replace', 'replaced');
      log(`${edit.file}:${edit.line}: ${replace} the marker for #${drop} with:`);
      log(`  ${edit.link}`);
    }
    if (live) writeFileSync(join(root, edit.file), edit.text, 'utf8');
  }
  if (!edits.length) log('Nothing to change.');
  else if (!live) log(`Dry run: ${edits.length} change(s). Add --live to make them.`);
  else {
    const next = `bun run duplicate:close ${keep} ${drop}`;
    log(`Made ${edits.length} change(s). After the pull request merges, run ${next}.`);
  }
  return true;
}

/** Every page, in either language, that still holds a marker for the issue. */
function pagesMarking(root: string, issue: number): string[] {
  return LOCALES.flatMap((locale) => {
    let files: string[] = [];
    try {
      files = readdirSync(join(root, WIKI_DIRS[locale])).filter((f) => /\.mdx?$/.test(f));
    } catch {
      files = [];
    }
    return files.sort().flatMap((f) => {
      const file = `${WIKI_DIRS[locale]}/${f}`;
      return markerLines(readFileSync(join(root, file), 'utf8'), issue).map((l) => `${file}:${l}`);
    });
  });
}

/**
 * The GitHub step, once the page edits have merged: prints the changes, and when live closes
 * DROP as a duplicate of KEEP, removes its milestone and pulls. False, with nothing changed,
 * while a page still holds DROP's marker or when the pair cannot be handled.
 */
export function closeDuplicate(
  github: GitHub,
  keep: number,
  drop: number,
  { live, cache, root, log, warn = log }: DuplicateOptions,
): boolean {
  const fail = failer(warn);
  if (keep === drop) return fail(`#${keep} cannot be a duplicate of itself`);
  const marking = pagesMarking(root, drop);
  if (marking.length) {
    for (const at of marking) {
      fail(
        `${at} still holds the marker for #${drop}; merge the pull request that replaces it first`,
      );
    }
    return false;
  }
  const kept = questionFrom(github.question(keep));
  const droppedIssue = github.question(drop);
  const dropped = questionFrom(droppedIssue);
  if (kept.status === 'duplicate') {
    const canonical =
      kept.duplicateOf === undefined ? 'its canonical issue' : `#${kept.duplicateOf}`;
    return fail(`#${keep} is itself a duplicate of ${canonical}; use ${canonical}`);
  }
  const done = dropped.status === 'duplicate' && dropped.duplicateOf === keep;
  if (dropped.status === 'duplicate' && !done) {
    return fail(
      `#${drop} is already closed as a duplicate of #${dropped.duplicateOf ?? 'another issue'}`,
    );
  }
  if (dropped.state !== 'open' && !done) {
    return fail(`#${drop} is closed; only an open question can become a duplicate`);
  }

  const verb = verbs(live);
  const milestone = droppedIssue.milestone?.number;
  const total = Number(!done) + Number(milestone !== undefined);
  if (!done) {
    log(`#${drop}: ${verb('close', 'closed')} as a duplicate of #${keep}`);
    if (live) github.closeIssue(drop, { duplicateOf: keep });
  }
  if (milestone !== undefined) {
    log(`#${drop}: ${verb('remove', 'removed')} from milestone ${milestone}`);
    if (live) github.removeMilestone(drop);
  }
  if (!total) log('Nothing to change.');
  else if (!live) log(`Dry run: ${total} change(s). Add --live to make them.`);
  else log(`Made ${total} change(s).`);
  if (live) log(pull(github, cache));
  return true;
}

if (import.meta.main) {
  const [step, ...args] = process.argv.slice(2);
  const [keep, drop] = args.filter((a) => !a.startsWith('--')).map(Number);
  const valid = (n: number) => Number.isInteger(n) && n > 0;
  if ((step !== 'mark' && step !== 'close') || !valid(keep) || !valid(drop)) {
    console.error('Usage: bun run duplicate:mark|duplicate:close KEEP DROP [--live]');
    process.exit(1);
  }
  const options = {
    live: args.includes('--live'),
    cache: CACHE,
    root: join(import.meta.dirname, '..'),
    log: console.log,
    warn: console.error,
  };
  const ok =
    step === 'close'
      ? closeDuplicate(liveGitHub(), keep, drop, options)
      : duplicatePages(keep, drop, options);
  if (!ok) process.exit(1);
}
