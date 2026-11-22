/**
 * Charting constellations: turns a plan (the open constellations as they should be) into the
 * GitHub operations that make the milestones match it. Used by `scripts/constellations.ts`
 * and the chart-constellations skill. Pure: reads the question cache, never GitHub.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../i18n/ui';
import { type Question, type QuestionGraph, type Questions, questionGraph } from '.';
import {
  CONSTELLATION_MARK,
  type Constellations,
  ENERGIES,
  type Energy,
  MILESTONE_CACHE,
  SIZES,
  type Size,
} from './constellations';

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

/** A cached milestone as written, constellation or not. */
export interface Milestone {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  issues: number[];
  description: string;
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

const LANGUAGE: Record<Locale, string> = { en: 'English', zh: 'Chinese' };

/** Which sizes fit how many questions, from the README's scale. */
const SIZE_FIT: Record<Size, { fits: (n: number) => boolean; means: string }> = {
  small: { fits: (n) => n <= 2, means: '1 or 2' },
  medium: { fits: (n) => n >= 3 && n <= 5, means: '3 to 5' },
  large: { fits: (n) => n >= 6, means: '6 or more' },
};

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** The milestone description in the README format. */
export function renderDescription(c: PlannedConstellation): string {
  const sections = LOCALES.map((locale) => {
    const name = locale === DEFAULT_LOCALE ? '' : `### ${c.name[locale].trim()}\n\n`;
    return `## ${locale}\n\n${name}${c.reasoning[locale].trim()}`;
  });
  return [
    `| Property | Value |\n|---|---|\n| Size | ${label(c.size)} |\n| Energy | ${label(c.energy)} |`,
    ...sections,
  ].join('\n\n');
}

/** Reads every cached milestone, by number; a missing cache holds none. */
export function loadMilestones(cacheDir: string): Milestone[] {
  const folder = join(cacheDir, MILESTONE_CACHE);
  let files: string[];
  try {
    files = readdirSync(folder).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      const raw = readFileSync(join(folder, f), 'utf8');
      const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
      const front = parseYaml(match?.[1] ?? '') as Omit<Milestone, 'description'>;
      return {
        ...front,
        issues: front.issues ?? [],
        description: raw.slice(match?.[0].length ?? 0).trim(),
      };
    })
    .sort((a, b) => a.number - b.number);
}

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
  const facts: string[] = [];
  if (graph.independent.includes(q.number)) facts.push('independent');
  else if (graph.peripheral.includes(q.number)) facts.push('peripheral');
  else if (graph.frontier.includes(q.number)) facts.push('frontier');
  if (graph.central.includes(q.number)) facts.push('central');
  if (q.blockedBy.length) facts.push(`blocked by ${q.blockedBy.map((n) => `#${n}`).join(', ')}`);
  const dependents = graph.dependents[q.number] ?? [];
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
  const live = constellations.open().filter((c) => c.questions.some((q) => q.state === 'open'));
  const done = constellations.open().filter((c) => !live.includes(c));

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

const isConstellation = (m: Milestone) => m.title.startsWith(CONSTELLATION_MARK);

function constellationErrors(
  c: PlannedConstellation,
  milestones: Milestone[],
  isOpen: (n: number) => boolean,
): string[] {
  const errors: string[] = [];
  const en = c.name?.[DEFAULT_LOCALE]?.trim() ?? '';
  const report = (message: string) => errors.push(`"${en}": ${message}`);
  if (en.startsWith(CONSTELLATION_MARK.trim())) {
    report(`write the ${LANGUAGE[DEFAULT_LOCALE]} name without the ✦ mark`);
  }
  for (const field of ['name', 'reasoning'] as const) {
    for (const key of Object.keys(c[field] ?? {})) {
      if (!(LOCALES as readonly string[]).includes(key)) {
        report(`unknown ${field} key "${key}"; quote text that holds a comma`);
      }
    }
  }
  for (const locale of LOCALES) {
    if (!c.name?.[locale]?.trim()) report(`no ${LANGUAGE[locale]} name`);
  }
  for (const locale of LOCALES) {
    if (!c.reasoning?.[locale]?.trim()) report(`no ${LANGUAGE[locale]} reasoning`);
  }
  for (const [property, scale, value] of [
    ['size', SIZES, c.size],
    ['energy', ENERGIES, c.energy],
  ] as const) {
    const list = scale.join(', ');
    if (value === undefined) report(`no ${property}; use one of ${list}`);
    else if (!(scale as readonly string[]).includes(value)) {
      report(`${property} "${value}" is not one of ${list}`);
    }
  }
  for (const n of c.questions ?? []) if (!isOpen(n)) report(`#${n} is not an open question`);

  const own = milestones.find((m) => m.number === c.number);
  if (c.number !== undefined && !(own && own.state === 'open' && isConstellation(own))) {
    report(`milestone ${c.number} is not an open constellation`);
  } else {
    const title = CONSTELLATION_MARK + en;
    const clash = milestones.find((m) => m.title === title && m.number !== c.number);
    if (clash) report(`milestone ${clash.number} already has the title "${title}"`);
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
  milestones: Milestone[],
): ChartResult {
  const planned = plan.constellations ?? [];
  const open = questions.all().filter((q) => q.state === 'open');
  const isOpen = (n: number) => questions.get(n)?.state === 'open';
  const errors = planned.flatMap((c) => constellationErrors(c, milestones, isOpen));
  const warnings: string[] = [];

  const names = new Map<string, number>();
  for (const c of planned) {
    const en = c.name?.[DEFAULT_LOCALE]?.trim() ?? '';
    names.set(en, (names.get(en) ?? 0) + 1);
    if (!c.questions?.length) errors.push(`"${en}" holds no questions`);
    else if (SIZE_FIT[c.size] && !SIZE_FIT[c.size].fits(c.questions.length)) {
      warnings.push(
        `"${en}" holds ${c.questions.length} questions; its size ${c.size} usually means ${SIZE_FIT[c.size].means}`,
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
    const title = CONSTELLATION_MARK + c.name.en.trim();
    const description = renderDescription(c);
    const current = milestones.find((m) => m.number === c.number);
    if (!current) {
      operations.push({ kind: 'create', ref: c.name.en.trim(), title, description });
      continue;
    }
    const edit: Operation = { kind: 'edit', number: current.number };
    if (current.title !== title) edit.title = title;
    if (current.description !== description) edit.description = description;
    if (edit.title !== undefined || edit.description !== undefined) operations.push(edit);
  }

  const milestoneOf = new Map(milestones.flatMap((m) => m.issues.map((n) => [n, m.number])));
  for (const q of open) {
    const c = target.get(q.number) as PlannedConstellation;
    const ref = c.number ?? c.name.en.trim();
    if (milestoneOf.get(q.number) !== ref) {
      operations.push({ kind: 'assign', issue: q.number, milestone: ref });
    }
  }

  const kept = new Set(planned.flatMap((c) => (c.number === undefined ? [] : [c.number])));
  for (const m of milestones) {
    if (m.state === 'open' && isConstellation(m) && !kept.has(m.number)) {
      operations.push({ kind: 'close', number: m.number });
    }
  }
  return { errors, warnings, operations };
}
