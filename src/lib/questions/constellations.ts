/**
 * Constellations: groups of related open questions, each sized for one session. Each one is
 * a GitHub milestone whose title starts with `✦ `; an issue's milestone is its constellation.
 * The pull mirrors the milestones into the question cache (`.questions/milestones/`), and
 * this module reads them back. Other milestones are ignored.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../i18n/ui';
import {
  type GithubIssue,
  getQuestions,
  isDuplicate,
  QUESTION_CACHE,
  type Question,
  type Questions,
  splitSections,
  tableRows,
} from '.';
import type { Problem } from './problems';

/** Where milestones sit inside the question cache. */
export const MILESTONE_CACHE = 'milestones';

/** A milestone is a constellation when its title starts with this mark. */
export const CONSTELLATION_MARK = '✦ ';

/** How long a constellation takes to settle; labels in `ui.ts` (`constellationSizes`). */
export const SIZES = ['small', 'medium', 'large'] as const;
/** How much energy a constellation needs; labels in `ui.ts` (`constellationEnergies`). */
export const ENERGIES = ['low', 'medium', 'high'] as const;

export type Size = (typeof SIZES)[number];
export type Energy = (typeof ENERGIES)[number];

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
}

export interface Constellations {
  /** Every constellation, open and closed, by number. */
  all(): Constellation[];
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

/** What the description says as written, for the checks. */
interface Written {
  size?: string;
  energy?: string;
  sections: Locale[];
}

const written = new WeakMap<Constellation, Written>();

const TITLE = /^###\s+(.+?)\s*$/;

/** The value of a property row, matching its name ignoring case. */
function row(rows: Record<string, string>, name: string): string | undefined {
  return Object.entries(rows).find(([key]) => key.toLowerCase() === name)?.[1];
}

function onScale<T extends string>(scale: readonly T[], value: string | undefined): T | undefined {
  return scale.find((s) => s === value?.toLowerCase());
}

function toConstellation(raw: string, questions: Questions): Constellation | undefined {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const front = parseYaml(match?.[1] ?? '') as MilestoneFrontmatter;
  if (!String(front.title).startsWith(CONSTELLATION_MARK)) return undefined;
  const { lead, sections } = splitSections(raw.slice(match?.[0].length ?? 0), 2, LOCALES);
  const rows = tableRows(lead);

  const name: Partial<Record<Locale, string>> = {
    [DEFAULT_LOCALE]: front.title.slice(CONSTELLATION_MARK.length).trim(),
  };
  const reasoning: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    let text = sections[locale];
    if (text === undefined) continue;
    if (locale !== DEFAULT_LOCALE) {
      const [first, ...rest] = text.split('\n');
      const heading = TITLE.exec(first);
      if (heading) {
        name[locale] = heading[1];
        text = rest.join('\n').trim();
      }
    }
    if (text) reasoning[locale] = text;
  }

  const constellation: Constellation = {
    number: front.number,
    url: front.url,
    state: front.state,
    name,
    reasoning,
    questions: (front.issues ?? [])
      .flatMap((n) => questions.get(n) ?? [])
      .filter((q) => !isDuplicate(q)),
  };
  const facts: Written = { sections: LOCALES.filter((l) => sections[l] !== undefined) };
  const size = row(rows, 'size');
  const energy = row(rows, 'energy');
  if (size !== undefined) facts.size = size;
  if (energy !== undefined) facts.energy = energy;
  const onSize = onScale(SIZES, size);
  if (onSize) constellation.size = onSize;
  const onEnergy = onScale(ENERGIES, energy);
  if (onEnergy) constellation.energy = onEnergy;
  written.set(constellation, facts);
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
  const byNumber = new Map(all.flatMap((c) => c.questions.map((q) => [q.number, c] as const)));
  const held = new Set(open.flatMap((c) => c.questions.map((q) => q.number)));
  const ungrouped = questions.all().filter((q) => q.state === 'open' && !held.has(q.number));
  return {
    all: () => [...all],
    open: () => [...open],
    finished: () => [...finished],
    toClose: () => [...toClose],
    of: (n) => byNumber.get(n),
    ungrouped: () => [...ungrouped],
  };
}

/** The repo's constellations, from the repo's question cache. */
export function getConstellations(questions: Questions = getQuestions()): Constellations {
  return loadConstellations(join(process.cwd(), QUESTION_CACHE), questions);
}

/**
 * Every open constellation's description has a Size and an Energy on their scales, the
 * English reasoning, and for each other locale a section with its name and reasoning.
 * Finished constellations are not drawn as open ones, so they are not checked.
 */
export function constellationProblems(constellations: Constellations): Problem[] {
  const problems: Problem[] = [];
  for (const c of constellations.open()) {
    const report = (message: string) => problems.push({ where: c.url, message });
    const facts = written.get(c) ?? { sections: [] };
    for (const [property, scale, value] of [
      ['Size', SIZES, facts.size],
      ['Energy', ENERGIES, facts.energy],
    ] as const) {
      const list = scale.join(', ');
      if (value === undefined) report(`no ${property} row; use one of ${list}`);
      else if (!onScale(scale, value)) report(`${property} "${value}" is not one of ${list}`);
    }
    for (const locale of LOCALES) {
      if (!facts.sections.includes(locale)) {
        report(`no \`## ${locale}\` section with the reasoning`);
        continue;
      }
      if (locale !== DEFAULT_LOCALE && !c.name[locale]) {
        report(`the \`## ${locale}\` section has no \`### \` name line`);
      }
      if (!c.reasoning[locale]) report(`the \`## ${locale}\` section has no reasoning`);
    }
  }
  return problems;
}
