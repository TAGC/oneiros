/**
 * The cluster list: the questions gathered by a clustering (their areas, or their
 * constellations) into ordered clusters, each question in exactly one. The Astrolabe's sky
 * and tiers and the Open questions page lay out this list; none of them decides membership.
 * Terms in `docs/constellations.md`.
 */
import { DEFAULT_LOCALE, type Locale, useTranslations } from '../../i18n/ui';
import { AREAS } from '../areas';
import { type Area, isDuplicate, type Question } from '.';
import { type Constellation, type Constellations, isFinished } from './constellations';

/** What gathers the questions: their areas, or their constellations. */
export type Clustering = 'areas' | 'constellations';

/**
 * An area; an open constellation; a finished one, holding its settled questions; or the
 * questions in none (no area, or no constellation).
 */
export type ClusterKind = 'area' | 'constellation' | 'finished' | 'none';

export interface Cluster {
  kind: ClusterKind;
  area?: Area;
  /** A constellation's milestone number. */
  constellation?: number;
  /** The area's or constellation's name in the locale, or English; none has no name. */
  name?: { text: string; lang: Locale };
  /** Its questions, by number. */
  questions: number[];
  open: number;
  total: number;
}

function cluster(fields: Omit<Cluster, 'questions' | 'open' | 'total'>, held: Question[]) {
  return {
    ...fields,
    questions: held.map((q) => q.number),
    open: held.filter((q) => q.state === 'open').length,
    total: held.length,
  };
}

function nameOf(c: Constellation, locale: Locale): Cluster['name'] {
  const own = c.name[locale];
  if (own !== undefined) return { text: own, lang: locale };
  return {
    text: c.name[DEFAULT_LOCALE] ?? `#${c.number}`,
    lang: DEFAULT_LOCALE,
  };
}

/**
 * The clusters of one clustering, in order, empty ones left out. By area: the wiki's areas,
 * then the questions of no area. By constellation: the open constellations, then the
 * questions in none, then the finished constellations, each by milestone number. A question
 * sits in its open constellation; else, if settled, in its finished one; else in none.
 * Duplicates sit in no cluster.
 */
export function clusterList(
  questions: Question[],
  constellations: Constellations | undefined,
  by: Clustering,
  locale: Locale,
): Cluster[] {
  const listed = questions.filter((q) => !isDuplicate(q)).sort((a, b) => a.number - b.number);
  if (by === 'areas') {
    const names = useTranslations(locale).areaNames;
    return [
      ...AREAS.map((area) =>
        cluster(
          {
            kind: 'area',
            area,
            name: { text: names[area] ?? area, lang: locale },
          },
          listed.filter((q) => q.area === area),
        ),
      ),
      cluster(
        { kind: 'none' },
        listed.filter((q) => !q.area),
      ),
    ].filter((c) => c.total);
  }

  const all = constellations?.all() ?? [];
  const of = new Map(all.flatMap((c) => c.questions.map((q) => [q.number, c] as const)));
  const home = (q: Question): number | undefined => {
    const c = of.get(q.number);
    if (!c) return undefined;
    return !isFinished(c) || q.state === 'closed' ? c.number : undefined;
  };
  const toCluster = (c: Constellation) =>
    cluster(
      {
        kind: isFinished(c) ? 'finished' : 'constellation',
        constellation: c.number,
        name: nameOf(c, locale),
      },
      listed.filter((q) => home(q) === c.number),
    );
  return [
    ...all.filter((c) => !isFinished(c)).map(toCluster),
    cluster(
      { kind: 'none' },
      listed.filter((q) => home(q) === undefined),
    ),
    ...all.filter(isFinished).map(toCluster),
  ].filter((c) => c.total);
}
