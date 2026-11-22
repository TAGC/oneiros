/**
 * The questions module: the only way into question data. Question issues on GitHub are
 * pulled into a local cache (`.questions/`, one Markdown file per issue); this module
 * writes that cache from GitHub's JSON and reads it back as question models.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../i18n/ui';
import { AREAS } from '../areas';
import { slugify } from '../site';
import type { CalloutKind } from '../wiki';

/** The question cache, relative to the repo root. */
export const QUESTION_CACHE = '.questions';

export type Area = (typeof AREAS)[number];

/** An issue as GitHub's REST API returns it, as far as the pull needs it. */
export interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: 'completed' | 'not_planned' | 'reopened' | 'duplicate' | null;
  labels: ({ name: string } | string)[];
  html_url: string;
  pull_request?: unknown;
}

export type CloseReason = 'completed' | 'not_planned';

export interface Question {
  number: number;
  url: string;
  kind: CalloutKind;
  area?: Area;
  state: 'open' | 'closed';
  closeReason?: CloseReason;
  /** The English title is the issue title; other locales take theirs from their section. */
  title: Partial<Record<Locale, string>>;
  /** The question text per locale, as Markdown with wiki links. */
  text: Partial<Record<Locale, string>>;
}

export interface Questions {
  /** Every question, by number. */
  all(): Question[];
  get(number: number): Question | undefined;
}

/** What one cache file's frontmatter holds. */
interface CacheFrontmatter {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  closeReason?: CloseReason;
  labels: string[];
}

const KIND_LABEL = /^kind:(open|conflict)$/;
const AREA_LABEL = /^area:(.+)$/;
const SECTION = /^##\s+(\S+)\s*$/;
const TITLE = /^###\s+(.+?)\s*$/;

/** The `## <locale>` sections of an issue body, keyed by locale code, trimmed. */
function localeSections(body: string): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {};
  let current: Locale | undefined;
  let lines: string[] = [];
  let fence = false;
  const flush = () => {
    if (current) out[current] = lines.join('\n').trim();
  };
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = fence ? null : SECTION.exec(line);
    if (heading) {
      flush();
      const code = heading[1];
      current = (LOCALES as readonly string[]).includes(code) ? (code as Locale) : undefined;
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return out;
}

function labelNames(issue: GithubIssue): string[] {
  return issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
}

function cacheFile(issue: GithubIssue): string {
  const front: CacheFrontmatter = {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    labels: labelNames(issue),
  };
  const reason = issue.state_reason;
  if (issue.state === 'closed' && (reason === 'completed' || reason === 'not_planned')) {
    front.closeReason = reason;
  }
  const sections = localeSections(issue.body ?? '');
  const markdown = LOCALES.filter((l) => sections[l] !== undefined)
    .map((l) => `## ${l}\n\n${sections[l]}\n`)
    .join('\n');
  return `---\n${stringifyYaml(front)}---\n\n${markdown}`;
}

/** Wipes the cache and writes one file per question issue; pull requests are skipped. */
export function writeQuestionCache(dir: string, issues: GithubIssue[]): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const issue of issues) {
    if (issue.pull_request) continue;
    writeFileSync(join(dir, `${issue.number}.md`), cacheFile(issue));
  }
}

function toQuestion(raw: string): Question {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const front = parseYaml(match?.[1] ?? '') as CacheFrontmatter;
  const sections = localeSections(raw.slice(match?.[0].length ?? 0));
  const labels = front.labels ?? [];
  const kind = labels.map((l) => KIND_LABEL.exec(l)?.[1]).find(Boolean) as CalloutKind | undefined;
  const areaSlug = labels.map((l) => AREA_LABEL.exec(l)?.[1]).find(Boolean);
  const area = AREAS.find((a) => slugify(a) === areaSlug);

  const title: Partial<Record<Locale, string>> = { [DEFAULT_LOCALE]: front.title };
  const text: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    let section = sections[locale];
    if (section === undefined) continue;
    if (locale !== DEFAULT_LOCALE) {
      const [first, ...rest] = section.split('\n');
      const heading = TITLE.exec(first);
      if (heading) {
        title[locale] = heading[1];
        section = rest.join('\n').trim();
      }
    }
    text[locale] = section;
  }

  const question: Question = {
    number: front.number,
    url: front.url,
    kind: kind ?? 'open',
    state: front.state,
    title,
    text,
  };
  if (area) question.area = area;
  if (front.closeReason) question.closeReason = front.closeReason;
  return question;
}

function cacheFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/** Reads a question cache; a missing cache holds no questions. */
export function loadQuestions(dir: string): Questions {
  const byNumber = new Map<number, Question>();
  for (const file of cacheFiles(dir)) {
    const question = toQuestion(readFileSync(join(dir, file), 'utf8'));
    byNumber.set(question.number, question);
  }
  const sorted = [...byNumber.values()].sort((a, b) => a.number - b.number);
  return { all: () => [...sorted], get: (n) => byNumber.get(n) };
}

let cached: { signature: string; questions: Questions } | undefined;

/** The repo's question cache; a build reads it once, dev re-reads it when it changes. */
export function getQuestions(): Questions {
  if (process.env.NODE_ENV === 'production' && cached) return cached.questions;
  const dir = join(process.cwd(), QUESTION_CACHE);
  const signature = cacheFiles(dir)
    .map((f) => `${f}:${statSync(join(dir, f)).mtimeMs}`)
    .sort()
    .join('|');
  if (cached?.signature !== signature) cached = { signature, questions: loadQuestions(dir) };
  return cached.questions;
}
