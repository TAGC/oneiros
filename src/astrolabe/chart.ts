/**
 * The Astrolabe's star chart: every question as a star, shaped from the questions module
 * for one locale. Pure data; the layouts in `sky.ts` and `tiers.ts` place it.
 */
import { DEFAULT_LOCALE, type Locale } from '../i18n/ui';
import { AREAS } from '../lib/areas';
import type { Area, Question, QuestionGraph } from '../lib/questions';
import type { Constellations, Energy, Size } from '../lib/questions/constellations';

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
export type StarRole = 'central' | 'peripheral' | 'independent';

export interface Star {
  number: number;
  question: Question;
  status: StarStatus;
  roles: StarRole[];
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

/**
 * A line between two stars: blocker to blocked (`open` while the blocker is open, else
 * `settled`), or breaker to undermined decision.
 */
export interface Thread {
  from: number;
  to: number;
  kind: 'open' | 'settled' | 'undermines';
}

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
  /** Open questions on the map that no open constellation holds, by number. */
  ungrouped: number[];
}

function inLocale(texts: Partial<Record<Locale, string>>, locale: Locale) {
  const own = texts[locale];
  if (own !== undefined) return { text: own, lang: locale };
  const fallback = texts[DEFAULT_LOCALE];
  return fallback === undefined ? undefined : { text: fallback, lang: DEFAULT_LOCALE };
}

function starStatus(q: Question, frontier: Set<number>): StarStatus {
  if (q.status !== 'open') return q.status;
  return frontier.has(q.number) ? 'frontier' : 'blocked';
}

function starRoles(n: number, graph: QuestionGraph): StarRole[] {
  const roles: StarRole[] = [];
  if (graph.central.includes(n)) roles.push('central');
  if (graph.independent.includes(n)) roles.push('independent');
  else if (graph.peripheral.includes(n)) roles.push('peripheral');
  return roles;
}

export function chartQuestions(
  questions: Question[],
  graph: QuestionGraph,
  locale: Locale,
  constellations?: Constellations,
): StarChart {
  const sorted = [...questions].sort((a, b) => a.number - b.number);
  const inChart = new Set(sorted.map((q) => q.number));
  const frontier = new Set(graph.frontier);
  const byNumber = new Map(sorted.map((q) => [q.number, q]));

  const threads: Thread[] = [];
  for (const q of sorted) {
    for (const b of q.blockedBy) {
      if (!inChart.has(b)) continue;
      const open = byNumber.get(b)!.status === 'open';
      threads.push({ from: b, to: q.number, kind: open ? 'open' : 'settled' });
    }
  }
  for (const q of sorted) {
    for (const u of q.underminedBy) {
      if (inChart.has(u)) threads.push({ from: u, to: q.number, kind: 'undermines' });
    }
  }
  threads.sort((a, b) => a.from - b.from || a.to - b.to);
  const ends = (kind: (t: Thread) => boolean, pick: 'from' | 'to', n: number) =>
    threads
      .filter((t) => kind(t) && (pick === 'from' ? t.to : t.from) === n)
      .map((t) => t[pick])
      .sort((a, b) => a - b);
  const blocking = (t: Thread) => t.kind !== 'undermines';
  const undermining = (t: Thread) => t.kind === 'undermines';

  const stars: Star[] = sorted.map((q) => {
    const own = q.title[locale];
    return {
      number: q.number,
      question: q,
      status: starStatus(q, frontier),
      roles: starRoles(q.number, graph),
      label: own ?? q.title[DEFAULT_LOCALE] ?? `#${q.number}`,
      labelLang: own === undefined ? DEFAULT_LOCALE : locale,
      blockedBy: ends(blocking, 'from', q.number),
      blocks: ends(blocking, 'to', q.number),
      underminedBy: ends(undermining, 'from', q.number),
      undermines: ends(undermining, 'to', q.number),
    };
  });

  const groups: ChartConstellation[] = (constellations?.open() ?? []).map((c) => {
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
  });
  for (const group of groups) {
    for (const n of group.stars) {
      const star = stars.find((s) => s.number === n)!;
      star.constellation = group.number;
    }
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
  return { locale, stars, threads, areas, counts, constellations: groups, ungrouped };
}
