/**
 * Charting constellations: turns a plan (the open constellations as they should be) into the
 * GitHub operations that make the milestones match it. Used by `scripts/constellations.ts`
 * and the chart-constellations skill. Pure: works from the loaded constellations, never GitHub.
 */
import { DEFAULT_LOCALE, LANGUAGE, LOCALES, type Locale } from '../../i18n/locale';
import { type Question, type QuestionGraph, type Questions, questionGraph } from '.';
import {
  CONSTELLATION_MARK,
  formatProblems,
  onScale,
  SIZES,
  statedCounts,
  writeConstellation,
} from './constellation-format';
import type { Constellations, Energy, Size } from './constellations';

/** One open constellation as the plan wants it. */
export interface PlannedConstellation {
  /** The milestone to keep; absent for a new one. */
  number?: number;
  name: Record<Locale, string>;
  size: Size;
  energy: Energy;
  reasoning: Record<Locale, string>;
  /** Its open questions; closed ones stay in their milestone untouched. */
  questions: number[];
}

/** Every open constellation as it should be after the run. */
export interface Plan {
  constellations: PlannedConstellation[];
}

/** A milestone a create made, named by its English name, or an existing one's number. */
export type MilestoneRef = number | string;

export type Operation =
  | { kind: 'create'; ref: string; title: string; description: string }
  | { kind: 'edit'; number: number; title?: string; description?: string }
  | { kind: 'assign'; issue: number; milestone: MilestoneRef }
  | { kind: 'close'; number: number };

export interface ChartResult {
  /** Any error leaves `operations` empty. */
  errors: string[];
  warnings: string[];
  operations: Operation[];
}

/** Which sizes fit how many questions, from the scale in docs/constellations.md. */
const SIZE_FIT: Record<Size, { fits: (n: number) => boolean; means: string }> = {
  small: { fits: (n) => n <= 2, means: '1 or 2' },
  medium: { fits: (n) => n >= 3 && n <= 5, means: '3 to 5' },
  large: { fits: (n) => n >= 6, means: '6 or more' },
};

/** The open constellations as a plan, with their open questions only. */
export function currentChart(constellations: Constellations): Plan {
  return {
    constellations: constellations.open().map((c) => ({
      number: c.number,
      name: Object.fromEntries(LOCALES.map((l) => [l, c.name[l] ?? ''])) as Record<Locale, string>,
      size: c.size as Size,
      energy: c.energy as Energy,
      reasoning: Object.fromEntries(LOCALES.map((l) => [l, c.reasoning[l] ?? ''])) as Record<
        Locale,
        string
      >,
      questions: c.questions.filter((q) => q.state === 'open').map((q) => q.number),
    })),
  };
}

/** One line per question: kind, area, page, title and its place in the question graph. */
function questionLine(q: Question, graph: QuestionGraph): string {
  const { place, roles, blockedBy, dependents } = graph.questions[q.number]!;
  const facts: string[] = [];
  if (roles.includes('independent')) facts.push('independent');
  else if (roles.includes('peripheral')) facts.push('peripheral');
  else if (place === 'frontier') facts.push('frontier');
  if (roles.includes('central')) facts.push('central');
  if (blockedBy.length) facts.push(`blocked by ${blockedBy.map((n) => `#${n}`).join(', ')}`);
  if (dependents.length) facts.push(`blocks ${dependents.map((n) => `#${n}`).join(', ')}`);
  const page = q.properties.page ? [`page ${q.properties.page}`] : [];
  return ['- #' + q.number + ' ' + q.kind, q.area ?? 'No area', ...page, q.title.en, ...facts].join(
    ' · ',
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * What the skill reads before charting: each open constellation with its open questions,
 * then the ungrouped questions, then the constellations ready to close.
 */
export function stateReport(questions: Questions, constellations: Constellations): string {
  const graph = questionGraph(questions.all());
  const open = questions.all().filter((q) => q.state === 'open');
  const ungrouped = constellations.ungrouped();
  const live = constellations.open();
  const done = constellations.toClose();

  const out = [
    `${plural(open.length, 'open question')} in ${plural(live.length, 'open constellation')}; ${ungrouped.length} ungrouped.`,
  ];
  for (const c of live) {
    const mine = c.questions.filter((q) => q.state === 'open');
    const facts = [c.size ?? 'no size', c.energy ?? 'no energy', `${mine.length} open`];
    facts.push(`${c.questions.length - mine.length} settled`);
    out.push(
      `## ${CONSTELLATION_MARK}${c.name.en} (milestone ${c.number}): ${facts.join(', ')}`,
      mine.map((q) => questionLine(q, graph)).join('\n'),
    );
  }
  if (ungrouped.length) {
    out.push('## Ungrouped', ungrouped.map((q) => questionLine(q, graph)).join('\n'));
  }
  if (done.length) {
    out.push(
      '## Ready to close',
      done
        .map(
          (c) => `- ${CONSTELLATION_MARK}${c.name.en} (milestone ${c.number}): no open questions`,
        )
        .join('\n'),
    );
  }
  return out.join('\n\n');
}

function constellationErrors(
  c: PlannedConstellation,
  constellations: Constellations,
  isOpen: (n: number) => boolean,
): string[] {
  const errors: string[] = [];
  const en = c.name?.[DEFAULT_LOCALE]?.trim() ?? '';
  const report = (message: string) => errors.push(`"${en}": ${message}`);
  if (en.startsWith(CONSTELLATION_MARK.trim())) report('write the English name without the ✦ mark');
  for (const field of ['name', 'reasoning'] as const) {
    for (const key of Object.keys(c[field] ?? {})) {
      if (!(LOCALES as readonly string[]).includes(key)) {
        report(`unknown ${field} key "${key}"; quote text that holds a comma`);
      }
    }
  }
  for (const problem of formatProblems(c)) report(problem);
  for (const n of c.questions ?? []) if (!isOpen(n)) report(`#${n} is not an open question`);

  const own = c.number === undefined ? undefined : constellations.get(c.number);
  if (c.number !== undefined && own?.state !== 'open') {
    report(`milestone ${c.number} is not an open constellation`);
  } else {
    const clash = constellations
      .all()
      .find((m) => m.number !== c.number && m.milestone?.title === CONSTELLATION_MARK + en);
    if (clash)
      report(`milestone ${clash.number} already has the title "${CONSTELLATION_MARK + en}"`);
  }
  return errors;
}

/**
 * The operations that make the open constellations match the plan: create or edit each
 * planned milestone, assign every open question whose milestone differs, then close each open
 * constellation left with no open questions. Milestones without the mark are never touched.
 */
export function chartOperations(
  plan: Plan,
  questions: Questions,
  constellations: Constellations,
): ChartResult {
  const planned = plan.constellations ?? [];
  const open = questions.all().filter((q) => q.state === 'open');
  const isOpen = (n: number) => questions.get(n)?.state === 'open';
  const errors = planned.flatMap((c) => constellationErrors(c, constellations, isOpen));
  const warnings: string[] = [];

  const names = new Map<string, number>();
  for (const c of planned) {
    const en = c.name?.[DEFAULT_LOCALE]?.trim() ?? '';
    names.set(en, (names.get(en) ?? 0) + 1);
    const size = onScale(SIZES, c.size);
    if (!c.questions?.length) errors.push(`"${en}" holds no questions`);
    else if (size && !SIZE_FIT[size].fits(c.questions.length)) {
      warnings.push(
        `"${en}" holds ${c.questions.length} questions; its size ${size} usually means ${SIZE_FIT[size].means}`,
      );
    }
    for (const locale of LOCALES) {
      const counts = statedCounts(c.reasoning?.[locale] ?? '');
      if (!counts.length) continue;
      warnings.push(
        `"${en}": the ${LANGUAGE[locale]} reasoning may state counts (${counts.map((p) => `"${p}"`).join(', ')}); name the shared theme only`,
      );
    }
  }
  for (const [name, count] of names) {
    if (count > 1) errors.push(`two planned constellations are named "${name}"`);
  }

  const target = new Map<number, PlannedConstellation>();
  for (const c of planned) {
    for (const n of c.questions ?? []) {
      const first = target.get(n);
      if (first) errors.push(`#${n} is in "${first.name.en}" and "${c.name.en}"`);
      else target.set(n, c);
    }
  }
  for (const q of open) {
    if (!target.has(q.number)) errors.push(`#${q.number} is open but in no planned constellation`);
  }
  if (errors.length) return { errors, warnings, operations: [] };

  const operations: Operation[] = [];
  for (const c of planned) {
    const { title, description } = writeConstellation(c);
    const current = c.number === undefined ? undefined : constellations.get(c.number)?.milestone;
    if (c.number === undefined || !current) {
      operations.push({ kind: 'create', ref: c.name.en.trim(), title, description });
      continue;
    }
    const edit: Operation = { kind: 'edit', number: c.number };
    if (current.title !== title) edit.title = title;
    if (current.description !== description) edit.description = description;
    if (edit.title !== undefined || edit.description !== undefined) operations.push(edit);
  }

  for (const q of open) {
    const c = target.get(q.number) as PlannedConstellation;
    const ref = c.number ?? c.name.en.trim();
    if (constellations.of(q.number)?.number !== ref) {
      operations.push({ kind: 'assign', issue: q.number, milestone: ref });
    }
  }

  const kept = new Set(planned.flatMap((c) => (c.number === undefined ? [] : [c.number])));
  for (const c of constellations.all()) {
    if (c.state === 'open' && !kept.has(c.number)) {
      operations.push({ kind: 'close', number: c.number });
    }
  }
  return { errors, warnings, operations };
}
