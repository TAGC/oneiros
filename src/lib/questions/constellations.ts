/**
 * Constellations: groups of related open questions, each sized for one session. Each one is
 * a GitHub milestone whose title starts with `✦ `; an issue's milestone is its constellation.
 * The pull mirrors the milestones into the question cache (`.questions/milestones/`), and
 * this module reads them back. Other milestones are ignored.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { Locale } from '../../i18n/locale';
import { splitFrontmatter } from '../frontmatter';
import {
  type GithubIssue,
  getQuestions,
  isDuplicate,
  QUESTION_CACHE,
  type Question,
  type Questions,
} from '.';
import {
  ENERGIES,
  type Energy,
  formatProblems,
  type MilestoneText,
  onScale,
  readConstellation,
  SIZES,
  type Size,
} from './constellation-format';
import type { Problem } from './problems';

/** Where milestones sit inside the question cache. */
const MILESTONE_CACHE = 'milestones';

/** A milestone as GitHub's REST API returns it, as far as the pull needs it. */
export interface GithubMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  html_url: string;
}

/** An issue with the milestone GitHub's issue JSON carries. */
export type MilestonedIssue = Pick<GithubIssue, 'number' | 'pull_request'> & {
  milestone?: Pick<GithubMilestone, 'number'> | null;
};

export interface Constellation {
  /** The milestone's number. */
  number: number;
  url: string;
  state: 'open' | 'closed';
  /** The English name is the milestone title without the mark; others open their section. */
  name: Partial<Record<Locale, string>>;
  /** Why these questions belong together, per locale. */
  reasoning: Partial<Record<Locale, string>>;
  /** Absent when the Size row is missing or off the scale (`check` fails). */
  size?: Size;
  /** Absent when the Energy row is missing or off the scale (`check` fails). */
  energy?: Energy;
  /** Its question issues, open and closed, by number; duplicates are left out. */
  questions: Question[];
  /** The milestone's title and description as written; set when loaded from the cache. */
  milestone?: MilestoneText;
  /** What breaks the milestone format (`formatProblems`), found once when read from the cache. */
  formatProblems?: string[];
}

export interface Constellations {
  /** Every constellation, open and closed, by number. */
  all(): Constellation[];
  /** One constellation, open or closed, by its milestone number. */
  get(number: number): Constellation | undefined;
  /** The open constellations that are not finished: the ones drawn and charted. */
  open(): Constellation[];
  /** The finished constellations (see `isFinished`), by number. */
  finished(): Constellation[];
  /** Finished constellations whose milestone is still open, waiting to be closed. */
  toClose(): Constellation[];
  /** The constellation holding a question, open or closed. */
  of(number: number): Constellation | undefined;
  /** Open questions in no open constellation, by number. */
  ungrouped(): Question[];
}

/**
 * A constellation is finished when its milestone is closed, or when every question in it is
 * closed: it stops showing as open at once, without waiting for its milestone to close. An
 * open milestone with no questions is not finished. Agreed with the designer on 22 Nov 2026.
 */
export function isFinished(c: Pick<Constellation, 'state' | 'questions'>): boolean {
  if (c.state === 'closed') return true;
  return c.questions.length > 0 && c.questions.every((q) => q.state === 'closed');
}

interface MilestoneFrontmatter {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  /** The question issues in this milestone, by number. */
  issues: number[];
}

/**
 * Writes one file per milestone into the question cache, listing the question issues in it.
 * Call it after `writeQuestionCache`, which wipes the cache.
 */
export function writeMilestoneCache(
  dir: string,
  milestones: GithubMilestone[],
  issues: MilestonedIssue[],
): void {
  const out = join(dir, MILESTONE_CACHE);
  mkdirSync(out, { recursive: true });
  for (const m of milestones) {
    const front: MilestoneFrontmatter = {
      number: m.number,
      title: m.title,
      url: m.html_url,
      state: m.state,
      issues: issues
        .filter((i) => !i.pull_request && i.milestone?.number === m.number)
        .map((i) => i.number)
        .sort((a, b) => a - b),
    };
    const description = (m.description ?? '').replace(/\r\n?/g, '\n').trim();
    writeFileSync(
      join(out, `${m.number}.md`),
      `---\n${stringifyYaml(front)}---\n\n${description}\n`,
    );
  }
}

function toConstellation(raw: string, questions: Questions): Constellation | undefined {
  const { data: front, body } = splitFrontmatter<MilestoneFrontmatter>(raw);
  const milestone = { title: String(front.title), description: body.trim() };
  const text = readConstellation(milestone);
  if (!text) return undefined;
  const constellation: Constellation = {
    number: front.number,
    url: front.url,
    state: front.state,
    name: text.name,
    reasoning: text.reasoning,
    questions: (front.issues ?? [])
      .flatMap((n) => questions.get(n) ?? [])
      .filter((q) => !isDuplicate(q)),
    milestone,
    formatProblems: formatProblems(text),
  };
  const size = onScale(SIZES, text.size);
  if (size) constellation.size = size;
  const energy = onScale(ENERGIES, text.energy);
  if (energy) constellation.energy = energy;
  return constellation;
}

function milestoneFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/** Reads the constellations from a question cache; a missing cache holds none. */
export function loadConstellations(dir: string, questions: Questions): Constellations {
  const folder = join(dir, MILESTONE_CACHE);
  const all = milestoneFiles(folder)
    .flatMap((f) => toConstellation(readFileSync(join(folder, f), 'utf8'), questions) ?? [])
    .sort((a, b) => a.number - b.number);
  const open = all.filter((c) => !isFinished(c));
  const finished = all.filter(isFinished);
  const toClose = finished.filter((c) => c.state === 'open');
  const byNumber = new Map(all.map((c) => [c.number, c]));
  const byQuestion = new Map(all.flatMap((c) => c.questions.map((q) => [q.number, c] as const)));
  const held = new Set(open.flatMap((c) => c.questions.map((q) => q.number)));
  const ungrouped = questions.all().filter((q) => q.state === 'open' && !held.has(q.number));
  return {
    all: () => [...all],
    get: (n) => byNumber.get(n),
    open: () => [...open],
    finished: () => [...finished],
    toClose: () => [...toClose],
    of: (n) => byQuestion.get(n),
    ungrouped: () => [...ungrouped],
  };
}

/** The repo's constellations, from the repo's question cache. */
export function getConstellations(questions: Questions = getQuestions()): Constellations {
  return loadConstellations(join(process.cwd(), QUESTION_CACHE), questions);
}

/**
 * Every open constellation's milestone follows the format (see `formatProblems`). Finished
 * constellations are not drawn as open ones, so they are not checked.
 */
export function constellationProblems(constellations: Constellations): Problem[] {
  return constellations.open().flatMap((c) => {
    const problems = c.formatProblems ?? formatProblems(c);
    return problems.map((message) => ({ where: c.url, message }));
  });
}
