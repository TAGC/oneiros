/**
 * Makes DROP a duplicate of KEEP (docs/duplicates.md): on DROP's page, in both languages, its
 * marker gives way to one line linking to KEEP's box (or goes, when KEEP's marker is on the
 * same page); DROP is closed as a duplicate of KEEP and leaves its constellation. Dry run by
 * default; a live run ends by pulling. Page titles come from the page files, read as UTF-8.
 * Usage: bun run duplicate KEEP DROP [--live]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { LOCALES, type Locale } from '../src/i18n/locale';
import { type Question, questionFrom } from '../src/lib/questions';
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

interface PageEdit {
  file: string;
  line: number;
  /** The marker's replacement; undefined removes it. */
  link?: string;
  text: string;
}

/** The edit that takes DROP's marker out of a page, or undefined when it has none. */
function markerEdit(raw: string, drop: number, link?: string): Omit<PageEdit, 'file'> | undefined {
  const front = FRONTMATTER.exec(raw)?.[0] ?? '';
  const firstLine = front.split('\n').length;
  const marker = readMarkers(raw.slice(front.length), firstLine).markers.find(
    (m) => m.issue === drop,
  );
  if (!marker) return undefined;
  const lines = raw.split('\n');
  const at = marker.line - 1;
  if (lines[at].trim() !== `> [!ISSUE ${drop}]`) {
    throw new Error(`line ${marker.line}: the marker for #${drop} spans more than one line`);
  }
  if (link !== undefined) lines.splice(at, 1, link);
  else {
    lines.splice(at, 1);
    if (lines[at] === '' && (at === 0 || lines[at - 1] === '')) lines.splice(at, 1);
  }
  return { line: marker.line, link, text: lines.join('\n') };
}

export interface DuplicateOptions extends RunOptions {
  /** The repo root the page folders sit in. */
  root: string;
}

/**
 * Prints what making DROP a duplicate of KEEP changes, and changes it when live. False, with
 * nothing changed, when the pair cannot be handled.
 */
export function duplicate(
  github: GitHub,
  keep: number,
  drop: number,
  { live, cache, root, log, warn = log }: DuplicateOptions,
): boolean {
  const fail = (message: string) => {
    warn(`error: ${message}`);
    return false;
  };
  if (keep === drop) return fail(`#${keep} cannot be a duplicate of itself`);
  const kept = questionFrom(github.question(keep));
  const droppedIssue = github.question(drop);
  const dropped = questionFrom(droppedIssue);

  if (kept.state !== 'open') {
    return fail(
      `#${keep} is closed; link the marker on #${drop}’s page to its settled rule by hand`,
    );
  }
  if (!kept.properties.page) return fail(`#${keep} has no Page row, so it has no box to link to`);
  const alreadyDone = dropped.status === 'duplicate' && dropped.duplicateOf === keep;
  if (dropped.status === 'duplicate' && !alreadyDone) {
    return fail(
      `#${drop} is already closed as a duplicate of #${dropped.duplicateOf ?? 'another issue'}`,
    );
  }
  if (dropped.state !== 'open' && !alreadyDone) {
    return fail(`#${drop} is closed; only an open question can become a duplicate`);
  }

  const edits: PageEdit[] = [];
  const slug = dropped.properties.page;
  if (!slug) log(`#${drop} has no Page row, so no page holds its marker`);
  for (const locale of slug ? LOCALES : []) {
    const file = pageFile(root, locale, slug!);
    if (!file) return fail(`#${drop}’s page ${slug} has no file in ${WIKI_DIRS[locale]}`);
    let link: string | undefined;
    if (slug !== kept.properties.page) {
      const home = pageFile(root, locale, kept.properties.page);
      if (!home) {
        return fail(`#${keep}’s page ${kept.properties.page} has no file in ${WIKI_DIRS[locale]}`);
      }
      const front = FRONTMATTER.exec(readFileSync(join(root, home), 'utf8'))?.[1] ?? '';
      const title = (parseYaml(front) as { title?: unknown } | null)?.title;
      if (typeof title !== 'string') return fail(`${home} has no title`);
      link = linkLine(locale, title, kept);
    }
    const edit = markerEdit(readFileSync(join(root, file), 'utf8'), drop, link);
    if (edit) edits.push({ file, ...edit });
    else log(`${file}: no marker for #${drop}`);
  }

  const close = !alreadyDone;
  const milestone = droppedIssue.milestone?.number;
  const total = edits.length + Number(close) + Number(milestone !== undefined);
  const verb = (would: string, did: string) => (live ? did : `would ${would}`);
  for (const edit of edits) {
    if (edit.link === undefined) {
      log(`${edit.file}:${edit.line}: ${verb('remove', 'removed')} the marker for #${drop}`);
    } else {
      log(
        `${edit.file}:${edit.line}: ${verb('replace', 'replaced')} the marker for #${drop} with:`,
      );
      log(`  ${edit.link}`);
    }
    if (live) writeFileSync(join(root, edit.file), edit.text, 'utf8');
  }
  if (close) {
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
  const args = process.argv.slice(2);
  const [keep, drop] = args.filter((a) => !a.startsWith('--')).map(Number);
  if (!Number.isInteger(keep) || !Number.isInteger(drop) || keep < 1 || drop < 1) {
    console.error('Usage: bun run duplicate KEEP DROP [--live]');
    process.exit(1);
  }
  const options = {
    live: args.includes('--live'),
    cache: CACHE,
    root: join(import.meta.dirname, '..'),
    log: console.log,
    warn: console.error,
  };
  if (!duplicate(liveGitHub(), keep, drop, options)) process.exit(1);
}
