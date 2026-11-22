/**
 * The questions module: the only way into question data. Question issues on GitHub are
 * pulled into a local cache (`.questions/`, one Markdown file per issue); this module
 * writes that cache from GitHub's JSON and reads it back as question models: the English
 * property table, Context, locale sections, blocked-by links, the answer comment and a
 * status derived from GitHub's state.
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
  /** How many comments the issue has. */
  comments?: number;
  pull_request?: unknown;
}

/** An issue with what the pull fetches for it separately: its blockers and its comments. */
export interface PulledIssue extends GithubIssue {
  /** From GitHub's `issues/N/dependencies/blocked_by`. */
  blockedBy?: Pick<GithubIssue, 'number'>[];
  /** From GitHub's `issues/N/comments`; only the answer comment is kept. */
  issueComments?: { body: string | null }[];
}

export type CloseReason = 'completed' | 'not_planned';

/**
 * Derived from GitHub's state, never stored: closed as not planned is ruled out, any other
 * close is decided, and a decided question with an Undermined by row is undermined.
 */
export type QuestionStatus = 'open' | 'decided' | 'ruled-out' | 'undermined';

/** The English property table at the top of an issue; every row is optional. */
export interface QuestionProperties {
  /** The slug of the page holding the question's marker, from the Page row's link. */
  page?: string;
  section?: string;
  /** For a conflict, the disagreeing sources as written: names or `[[wiki links]]`. */
  sources?: string[];
  raised?: string;
  related?: number[];
}

export interface Question {
  number: number;
  url: string;
  kind: CalloutKind;
  area?: Area;
  state: 'open' | 'closed';
  closeReason?: CloseReason;
  status: QuestionStatus;
  /** The English title is the issue title; other locales take theirs from their section. */
  title: Partial<Record<Locale, string>>;
  /** The question text per locale, as Markdown with wiki links. */
  text: Partial<Record<Locale, string>>;
  properties: QuestionProperties;
  /** Free-form English discussion that led to the question. */
  context?: string;
  /** Open issues blocking this one, from GitHub's native blocked-by links. */
  blockedBy: number[];
  /** Decided questions whose premise these issues broke, from the Undermined by row. */
  underminedBy: number[];
  /** The answer comment's text per locale; absent when there is no answer comment. */
  answer?: Partial<Record<Locale, string>>;
  /** The answer comment's last line: who decided, when, where, and the PR that lands it. */
  provenance?: string;
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
  /** The property table's rows as written, keyed by property name. */
  properties?: Record<string, string>;
  blockedBy?: number[];
  provenance?: string;
}

const KIND_LABEL = /^kind:(open|conflict)$/;
const AREA_LABEL = /^area:(.+)$/;
const TITLE = /^###\s+(.+?)\s*$/;

const LOCALE_CODES: readonly string[] = LOCALES;
const CONTEXT = 'Context';
const ANSWER = 'Answer';
const BODY_SECTIONS = [CONTEXT, ...LOCALE_CODES];
const CACHE_SECTIONS = [...BODY_SECTIONS, ANSWER];
const ANSWER_HEADING = /^##\s+Answer\s*$/;

/**
 * Splits Markdown at headings of one level whose text is in `names`, outside code fences.
 * Returns the text before the first such heading and each section, trimmed.
 */
function splitSections(
  markdown: string,
  level: number,
  names: readonly string[],
): { lead: string; sections: Record<string, string> } {
  const heading = new RegExp(`^#{${level}}\\s+(\\S.*?)\\s*$`);
  const sections: Record<string, string> = {};
  let current: string | undefined;
  let lines: string[] = [];
  let lead = '';
  let fence = false;
  const flush = () => {
    const text = lines.join('\n').trim();
    if (current === undefined) lead = text;
    else sections[current] = text;
  };
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const match = fence ? null : heading.exec(line);
    if (match && names.includes(match[1])) {
      flush();
      current = match[1];
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return { lead, sections };
}

/** The rows of the first Markdown table in `text`, header and delimiter rows skipped. */
function tableRows(text: string): Record<string, string> {
  const rows: Record<string, string> = {};
  const lines = text.split('\n').filter((l) => l.trim().startsWith('|'));
  for (const line of lines.slice(2)) {
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim());
    if (cells[0] && cells[1]) rows[cells[0]] = cells[1];
  }
  return rows;
}

function labelNames(issue: GithubIssue): string[] {
  return issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
}

/** The last comment that opens with an `## Answer` heading, without that heading. */
function answerComment(issue: PulledIssue): string | undefined {
  const answers = (issue.issueComments ?? [])
    .map((c) => (c.body ?? '').replace(/\r\n?/g, '\n').trim())
    .filter((body) => ANSWER_HEADING.test(body.split('\n')[0]));
  return answers.at(-1)?.split('\n').slice(1).join('\n');
}

function cacheFile(issue: PulledIssue): string {
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
  const { lead, sections } = splitSections(issue.body ?? '', 2, BODY_SECTIONS);
  const properties = tableRows(lead);
  if (Object.keys(properties).length) front.properties = properties;
  const blockedBy = (issue.blockedBy ?? []).map((b) => b.number).sort((a, b) => a - b);
  if (blockedBy.length) front.blockedBy = blockedBy;

  const parts = BODY_SECTIONS.filter((name) => sections[name] !== undefined).map(
    (name) => `## ${name}\n\n${sections[name]}\n`,
  );
  const answer = answerComment(issue);
  if (answer !== undefined) {
    const { sections: locales } = splitSections(answer, 3, LOCALE_CODES);
    const last = Object.keys(locales).at(-1) as Locale | undefined;
    const paragraphs = last ? locales[last]!.split(/\n\s*\n/) : [];
    const final = paragraphs.at(-1)?.trim();
    if (last && paragraphs.length > 1 && final && !final.includes('\n')) {
      front.provenance = final;
      locales[last] = paragraphs.slice(0, -1).join('\n\n').trim();
    }
    const text = LOCALES.filter((l) => locales[l] !== undefined)
      .map((l) => `### ${l}\n\n${locales[l]}\n`)
      .join('\n');
    parts.push(`## ${ANSWER}\n\n${text}`);
  }
  return `---\n${stringifyYaml(front)}---\n\n${parts.join('\n')}`;
}

/** Wipes the cache and writes one file per question issue; pull requests are skipped. */
export function writeQuestionCache(dir: string, issues: PulledIssue[]): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const issue of issues) {
    if (issue.pull_request) continue;
    writeFileSync(join(dir, `${issue.number}.md`), cacheFile(issue));
  }
}

const ISSUE_REF = /(?:#|\/issues\/)(\d+)/g;

function issueRefs(value: string | undefined): number[] {
  return [...(value ?? '').matchAll(ISSUE_REF)].map((m) => Number(m[1]));
}

/** The slug a Page row links to: the last segment of its link's path. */
function pageSlug(value: string): string | undefined {
  const url = /\]\(([^)\s]+)\)/.exec(value)?.[1] ?? value;
  const segment = url.split(/[?#]/)[0].split('/').filter(Boolean).at(-1);
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Splits a Source row at commas and "and", keeping wiki links whole. */
function sourceNames(value: string): string[] {
  const links: string[] = [];
  const masked = value.replace(/\[\[[^\]]*\]\]/g, (link) => `\0${links.push(link) - 1}\0`);
  return masked
    .split(/,|\s+and\s+/)
    .map((part) => part.replace(/\0(\d+)\0/g, (_, i: string) => links[Number(i)]).trim())
    .filter(Boolean);
}

/** A property row's value; row names are matched ignoring case. */
function propertyRow(rows: Record<string, string>, name: string): string | undefined {
  return Object.entries(rows).find(([key]) => key.toLowerCase() === name)?.[1];
}

function toProperties(rows: Record<string, string>): QuestionProperties {
  const row = (name: string) => propertyRow(rows, name);
  const out: QuestionProperties = {};
  const page = row('page');
  const slug = page && pageSlug(page);
  if (slug) out.page = slug;
  const section = row('section');
  if (section) out.section = section;
  const source = row('source');
  if (source) out.sources = sourceNames(source);
  const raised = row('raised');
  if (raised) out.raised = raised;
  const related = issueRefs(row('related'));
  if (related.length) out.related = related;
  return out;
}

function deriveStatus(question: Omit<Question, 'status'>): QuestionStatus {
  if (question.state === 'open') return 'open';
  if (question.closeReason === 'not_planned') return 'ruled-out';
  return question.underminedBy.length ? 'undermined' : 'decided';
}

function toQuestion(raw: string): Question {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const front = parseYaml(match?.[1] ?? '') as CacheFrontmatter;
  const { sections } = splitSections(raw.slice(match?.[0].length ?? 0), 2, CACHE_SECTIONS);
  const rows = front.properties ?? {};
  const labels = front.labels ?? [];
  const kind = labels.map((l) => KIND_LABEL.exec(l)?.[1]).find(Boolean) as CalloutKind | undefined;
  const areaSlug = labels.map((l) => AREA_LABEL.exec(l)?.[1]).find(Boolean);
  const area = AREAS.find((a) => slugify(a) === areaSlug);

  const title: Partial<Record<Locale, string>> = { [DEFAULT_LOCALE]: front.title };
  const text: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    let section: string | undefined = sections[locale];
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
    status: 'open',
    title,
    text,
    properties: toProperties(rows),
    blockedBy: front.blockedBy ?? [],
    underminedBy: issueRefs(propertyRow(rows, 'undermined by')),
  };
  if (area) question.area = area;
  if (front.closeReason) question.closeReason = front.closeReason;
  if (sections[CONTEXT]) question.context = sections[CONTEXT];
  if (front.provenance) question.provenance = front.provenance;
  if (sections[ANSWER] !== undefined) {
    const { sections: locales } = splitSections(sections[ANSWER], 3, LOCALE_CODES);
    question.answer = Object.fromEntries(
      LOCALES.filter((l) => locales[l]).map((l) => [l, locales[l]]),
    );
  }
  question.status = deriveStatus(question);
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

export { CENTRAL_MIN_DEPENDENTS, type QuestionGraph, questionGraph } from './graph';
