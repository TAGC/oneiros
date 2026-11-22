/**
 * The Astrolabe's star chart: every question as a star, shaped from the questions module
 * for one locale. Pure data; the layouts in `sky.ts` and `tiers.ts` place it.
 */
import { DEFAULT_LOCALE, type Locale } from '../i18n/ui';
import { AREAS } from '../lib/areas';
import {
  type Area,
  isDuplicate,
  type Place,
  type Question,
  type QuestionGraph,
  type Role,
  type Thread,
} from '../lib/questions';
import type { Constellation, Constellations, Energy, Size } from '../lib/questions/constellations';

/** Open questions split into frontier and blocked; closed ones keep their status. */
export type StarStatus = 'frontier' | 'blocked' | 'decided' | 'ruled-out' | 'undermined';

export const STAR_STATUSES: StarStatus[] = [
  'frontier',
  'blocked',
  'decided',
  'ruled-out',
  'undermined',
];

/** Independent questions are always peripheral too; a star shows only the stronger mark. */
export type StarRole = Role;

export interface Star {
  number: number;
  question: Question;
  status: StarStatus;
  roles: StarRole[];
  /** From the question graph: 0 on the frontier and for a settled question. */
  stepsOut: number;
  /** The title in the chart's locale, or English when it has none. */
  label: string;
  labelLang: Locale;
  /** Blockers in the chart, sorted. */
  blockedBy: number[];
  /** Questions in the chart that this one blocks, sorted. */
  blocks: number[];
  /** Undermined decisions in the chart whose premise this question broke, sorted. */
  underminedBy: number[];
  undermines: number[];
  /** The open constellation holding this question, by milestone number. */
  constellation?: number;
  /** For a settled question, the finished constellation it was settled in. */
  finishedIn?: number;
}

/** An open constellation, as the map draws it. */
export interface ChartConstellation {
  number: number;
  url: string;
  /** The name in the chart's locale, or English. */
  name: string;
  nameLang: Locale;
  reasoning?: { text: string; lang: Locale };
  size?: Size;
  energy?: Energy;
  /** How many of its questions are closed, of how many. */
  settled: number;
  total: number;
  /** Its questions on the map, open and closed, by number. */
  stars: number[];
}

/** A line between two stars, as the question graph gives it. */
export type { Thread };

export interface AreaGroup {
  /** Undefined for questions with no area label. */
  area?: Area;
  stars: number[];
}

export type StarCounts = Record<StarStatus | 'open', number>;

export interface StarChart {
  locale: Locale;
  /** Every star, by number. */
  stars: Star[];
  threads: Thread[];
  /** Areas with stars, in the wiki's order, then questions of no area. */
  areas: AreaGroup[];
  counts: StarCounts;
  /** Open constellations, by milestone number; empty without constellation data. */
  constellations: ChartConstellation[];
  /** Finished constellations with settled questions on the map, by milestone number. */
  finished: ChartConstellation[];
  /** Open questions on the map that no open constellation holds, by number. */
  ungrouped: number[];
}

function inLocale(texts: Partial<Record<Locale, string>>, locale: Locale) {
  const own = texts[locale];
  if (own !== undefined) return { text: own, lang: locale };
  const fallback = texts[DEFAULT_LOCALE];
  return fallback === undefined ? undefined : { text: fallback, lang: DEFAULT_LOCALE };
}

function starStatus(q: Question, place: Place): StarStatus {
  if (q.status === 'open') return place === 'frontier' ? 'frontier' : 'blocked';
  return q.status === 'duplicate' ? 'decided' : q.status;
}

function starRoles(roles: Role[]): StarRole[] {
  return roles.includes('independent') ? roles.filter((r) => r !== 'peripheral') : roles;
}

export function chartQuestions(
  questions: Question[],
  graph: QuestionGraph,
  locale: Locale,
  constellations?: Constellations,
): StarChart {
  // The one place that decides which questions the map shows: duplicates stand in for
  // their canonical issue and stay off it.
  const sorted = questions.filter((q) => !isDuplicate(q)).sort((a, b) => a.number - b.number);
  const inChart = new Set(sorted.map((q) => q.number));
  const byNumber = new Map(sorted.map((q) => [q.number, q]));

  const threads = graph.threads.filter((t) => inChart.has(t.from) && inChart.has(t.to));
  const ends = (kind: (t: Thread) => boolean, pick: 'from' | 'to', n: number) =>
    threads
      .filter((t) => kind(t) && (pick === 'from' ? t.to : t.from) === n)
      .map((t) => t[pick])
      .sort((a, b) => a - b);
  const blocking = (t: Thread) => t.kind !== 'undermines';
  const undermining = (t: Thread) => t.kind === 'undermines';

  const stars: Star[] = sorted.map((q) => {
    const own = q.title[locale];
    const facts = graph.questions[q.number]!;
    return {
      number: q.number,
      question: q,
      status: starStatus(q, facts.place),
      roles: starRoles(facts.roles),
      stepsOut: facts.stepsOut,
      label: own ?? q.title[DEFAULT_LOCALE] ?? `#${q.number}`,
      labelLang: own === undefined ? DEFAULT_LOCALE : locale,
      blockedBy: ends(blocking, 'from', q.number),
      blocks: ends(blocking, 'to', q.number),
      underminedBy: ends(undermining, 'from', q.number),
      undermines: ends(undermining, 'to', q.number),
    };
  });

  const toGroup = (c: Constellation): ChartConstellation => {
    const name = inLocale(c.name, locale)!;
    const group: ChartConstellation = {
      number: c.number,
      url: c.url,
      name: name.text,
      nameLang: name.lang,
      settled: c.questions.filter((q) => q.state === 'closed').length,
      total: c.questions.length,
      stars: c.questions
        .map((q) => q.number)
        .filter((n) => inChart.has(n))
        .sort((a, b) => a - b),
    };
    const reasoning = inLocale(c.reasoning, locale);
    if (reasoning) group.reasoning = reasoning;
    if (c.size) group.size = c.size;
    if (c.energy) group.energy = c.energy;
    return group;
  };
  const groups = (constellations?.open() ?? []).map(toGroup);
  for (const group of groups) {
    for (const n of group.stars) {
      const star = stars.find((s) => s.number === n)!;
      star.constellation = group.number;
    }
  }
  // A settled question keeps its finished constellation; a reopened one there is ungrouped.
  const finished = (constellations?.finished() ?? [])
    .map(toGroup)
    .map((group) => ({
      ...group,
      stars: group.stars.filter((n) => byNumber.get(n)!.status !== 'open'),
    }))
    .filter((group) => group.stars.length);
  for (const group of finished) {
    for (const n of group.stars) stars.find((s) => s.number === n)!.finishedIn = group.number;
  }
  const ungrouped = (constellations?.ungrouped() ?? [])
    .map((q) => q.number)
    .filter((n) => inChart.has(n))
    .sort((a, b) => a - b);

  const areas: AreaGroup[] = [...AREAS, undefined]
    .map((area) => ({ area, stars: sorted.filter((q) => q.area === area).map((q) => q.number) }))
    .filter((g) => g.stars.length)
    .map((g) => (g.area ? g : { stars: g.stars }));
  const counts = Object.fromEntries(['open', ...STAR_STATUSES].map((k) => [k, 0])) as StarCounts;
  for (const s of stars) {
    counts[s.status]++;
    if (s.question.status === 'open') counts.open++;
  }
  return { locale, stars, threads, areas, counts, constellations: groups, finished, ungrouped };
}

/**
 * Settled questions (decided, ruled out, undermined) that the night sky and tiers hide unless
 * "Show settled" is on: those with no thread to an open question. Agreed with the designer on
 * 22 Nov 2026. They keep their place in every layout, so showing them moves nothing.
 */
export function quietSettled(chart: StarChart): number[] {
  const open = new Set(
    chart.stars.filter((s) => s.question.status === 'open').map((s) => s.number),
  );
  const linked = new Set<number>();
  for (const t of chart.threads) {
    if (open.has(t.to)) linked.add(t.from);
    if (open.has(t.from)) linked.add(t.to);
  }
  return chart.stars
    .filter((s) => !open.has(s.number) && !linked.has(s.number))
    .map((s) => s.number);
}
