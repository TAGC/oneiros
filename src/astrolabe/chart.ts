/**
 * The Astrolabe's star chart: every question as a star, shaped from the questions module
 * for one locale. Pure data; the layouts in `sky.ts` and `tiers.ts` place it.
 */
import { DEFAULT_LOCALE, inLocale, type Locale } from '../i18n/locale';
import {
  type Place,
  type Question,
  type QuestionGraph,
  type Role,
  type Thread,
  withoutDuplicates,
} from '../lib/questions';
import { type Cluster, type Clustering, clusterList } from '../lib/questions/clusters';
import type { Energy, Size } from '../lib/questions/constellation-format';
import type { Constellation, Constellations } from '../lib/questions/constellations';

/** Open questions split into frontier and blocked; closed ones keep their status. */
export type StarStatus = 'frontier' | 'blocked' | 'decided' | 'ruled-out' | 'undermined';

export const STAR_STATUSES: StarStatus[] = [
  'frontier',
  'blocked',
  'decided',
  'ruled-out',
  'undermined',
];

export interface Star {
  number: number;
  question: Question;
  status: StarStatus;
  /** Independent questions are always peripheral too; a star shows only the stronger mark. */
  roles: Role[];
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
}

/** A constellation the map draws: an open one, or a finished one with a cluster. */
export interface ChartConstellation {
  number: number;
  url: string;
  /** The name in the chart's locale, or English. */
  name: string;
  nameLang: Locale;
  reasoning?: { text: string; lang: Locale };
  size?: Size;
  energy?: Energy;
  finished: boolean;
  /**
   * Its cluster in the chart's Constellations clustering, the same object, so membership has
   * one source: its questions on the map, open and closed, and its counts. Absent when none
   * of its questions is on the map.
   */
  cluster?: Cluster;
}

export type StarCounts = Record<StarStatus | 'open', number>;

export interface StarChart {
  locale: Locale;
  /** Every star, by number. */
  stars: Star[];
  threads: Thread[];
  /** The stars gathered each way, from the questions module's cluster list. */
  clusters: Record<Clustering, Cluster[]>;
  counts: StarCounts;
  /**
   * The constellations the map draws: the open ones, then the finished ones with a cluster,
   * each by milestone number; empty without constellation data.
   */
  constellations: ChartConstellation[];
}

function starStatus(q: Question, place: Place): StarStatus {
  if (q.status === 'open') return place === 'frontier' ? 'frontier' : 'blocked';
  return q.status === 'duplicate' ? 'decided' : q.status;
}

function starRoles(roles: Role[]): Role[] {
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
  const sorted = withoutDuplicates(questions);
  const inChart = new Set(sorted.map((q) => q.number));

  const threads = graph.threads.filter((t) => inChart.has(t.from) && inChart.has(t.to));
  const ends = (kind: (t: Thread) => boolean, pick: 'from' | 'to', n: number) =>
    threads
      .filter((t) => kind(t) && (pick === 'from' ? t.to : t.from) === n)
      .map((t) => t[pick])
      .sort((a, b) => a - b);
  const blocking = (t: Thread) => t.kind !== 'undermines';
  const undermining = (t: Thread) => t.kind === 'undermines';

  const stars: Star[] = sorted.map((q) => {
    const label = inLocale(q.title, locale);
    const facts = graph.questions[q.number]!;
    return {
      number: q.number,
      question: q,
      status: starStatus(q, facts.place),
      roles: starRoles(facts.roles),
      stepsOut: facts.stepsOut,
      label: label?.text ?? `#${q.number}`,
      labelLang: label?.lang ?? DEFAULT_LOCALE,
      blockedBy: ends(blocking, 'from', q.number),
      blocks: ends(blocking, 'to', q.number),
      underminedBy: ends(undermining, 'from', q.number),
      undermines: ends(undermining, 'to', q.number),
    };
  });

  const clusters: Record<Clustering, Cluster[]> = {
    areas: clusterList(sorted, constellations, 'areas', locale),
    constellations: constellations
      ? clusterList(sorted, constellations, 'constellations', locale)
      : [],
  };
  const clusterOf = new Map(
    clusters.constellations.flatMap((c) =>
      c.constellation === undefined ? [] : [[c.constellation, c] as const],
    ),
  );
  const toGroup = (c: Constellation): ChartConstellation => {
    const held = clusterOf.get(c.number);
    const name = inLocale(c.name, locale)!;
    const group: ChartConstellation = {
      number: c.number,
      url: c.url,
      name: name.text,
      nameLang: name.lang,
      finished: held?.kind === 'finished',
    };
    if (held) group.cluster = held;
    const reasoning = inLocale(c.reasoning, locale);
    if (reasoning) group.reasoning = reasoning;
    if (c.size) group.size = c.size;
    if (c.energy) group.energy = c.energy;
    return group;
  };
  const groups = [
    ...(constellations?.open() ?? []),
    ...(constellations?.finished() ?? []).filter((c) => clusterOf.has(c.number)),
  ].map(toGroup);
  for (const star of stars) {
    const held = clusters.constellations.find((c) => c.questions.includes(star.number));
    if (held?.kind === 'constellation') star.constellation = held.constellation;
  }

  const counts = Object.fromEntries(['open', ...STAR_STATUSES].map((k) => [k, 0])) as StarCounts;
  for (const s of stars) {
    counts[s.status]++;
    if (s.question.status === 'open') counts.open++;
  }
  return {
    locale,
    stars,
    threads,
    clusters,
    counts,
    constellations: groups,
  };
}

/** The open constellations the map draws, by milestone number. */
export function openConstellations(chart: StarChart): ChartConstellation[] {
  return chart.constellations.filter((c) => !c.finished);
}

/** A constellation's questions on the map, open and closed, by number. */
export function starsOf(c: ChartConstellation): number[] {
  return c.cluster?.questions ?? [];
}

/** How many of a constellation's questions on the map are settled, of how many. */
export function progressOf(c: ChartConstellation): { settled: number; total: number } {
  return c.cluster
    ? { settled: c.cluster.total - c.cluster.open, total: c.cluster.total }
    : { settled: 0, total: 0 };
}

/** Open questions on the map that no open constellation holds, by number. */
export function ungroupedStars(chart: StarChart): number[] {
  const open = new Set(chart.stars.filter((s) => s.question.state === 'open').map((s) => s.number));
  const none = chart.clusters.constellations.find((c) => c.kind === 'none');
  return (none?.questions ?? []).filter((n) => open.has(n));
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
