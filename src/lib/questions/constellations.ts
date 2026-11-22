/**
 * Constellations: groups of related open questions, each sized for one session, kept by hand
 * in `src/data/constellations.yaml` and read only through this module. Loading drops closed
 * issues and issues that are not question issues, so a stale entry never breaks the build;
 * `constellationProblems` is the strict check that forces the file to be cleaned up.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMap, isScalar, isSeq, LineCounter, type Node, parseDocument } from 'yaml';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../i18n/ui';
import { getQuestions, QUESTION_CACHE, type Question, type Questions } from '.';
import type { Problem } from './problems';

/** The constellations file, relative to the repo root. */
export const CONSTELLATIONS_FILE = 'src/data/constellations.yaml';

/** How long a constellation takes to settle; labels in `ui.ts` (`constellationSize`). */
export const SIZES = ['small', 'medium', 'large'] as const;
/** How much energy a constellation needs; labels in `ui.ts` (`constellationEnergy`). */
export const ENERGIES = ['low', 'medium', 'high'] as const;

export type Size = (typeof SIZES)[number];
export type Energy = (typeof ENERGIES)[number];

export interface Constellation {
  /** The English name is always present. */
  name: Partial<Record<Locale, string>>;
  /** Why these questions belong together; the English reasoning is always present. */
  reasoning: Partial<Record<Locale, string>>;
  size: Size;
  energy: Energy;
  /** Its open question issues, in file order. */
  questions: Question[];
}

export interface Constellations {
  /** Constellations with at least one open question, in file order. */
  all(): Constellation[];
  /** The constellation holding an open question. */
  of(number: number): Constellation | undefined;
  /** Open questions in no constellation, by number. */
  ungrouped(): Question[];
}

/** What a missing issue really is on GitHub, when the strict check can find out. */
export type IssueLookup = (number: number) => 'missing' | 'not-question' | undefined;

const KEYS = ['name', 'reasoning', 'size', 'energy', 'issues'];

interface Entry {
  line: number;
  name: Partial<Record<Locale, string>>;
  reasoning: Partial<Record<Locale, string>>;
  size: Size;
  energy: Energy;
  issues: { number: number; line: number }[];
}

interface Parsed {
  entries: Entry[];
  /** In file order. The loader throws on fatal ones, which make the file unreadable. */
  problems: (Problem & { fatal: boolean })[];
}

function lineOf(lines: LineCounter, node: unknown): number {
  const range = (node as Node | undefined)?.range;
  return range ? lines.linePos(range[0]).line : 1;
}

function localised(
  value: unknown,
  field: string,
  report: (message: string, fatal: boolean) => void,
): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    report(`\`${field}\` must map locale codes (${LOCALES.join(', ')}) to text`, true);
    return out;
  }
  for (const [key, text] of Object.entries(value)) {
    if (!(LOCALES as readonly string[]).includes(key)) {
      report(`\`${field}\` has unknown locale \`${key}\``, false);
    } else if (typeof text === 'string' && text.trim()) {
      out[key as Locale] = text.trim();
    }
  }
  for (const locale of LOCALES) {
    if (out[locale]) continue;
    report(`no \`${field}.${locale}\``, locale === DEFAULT_LOCALE);
  }
  return out;
}

function parse(file: string): Parsed {
  const parsed: Parsed = { entries: [], problems: [] };
  if (!existsSync(file)) return parsed;
  const lines = new LineCounter();
  const doc = parseDocument(readFileSync(file, 'utf8'), { lineCounter: lines });
  for (const error of doc.errors) {
    const where = `${file}:${error.linePos?.[0].line ?? 1}`;
    parsed.problems.push({ where, message: error.message, fatal: true });
  }
  if (parsed.problems.length || doc.contents === null) return parsed;
  if (!isSeq(doc.contents)) {
    const message = 'the file must be a list of constellations';
    parsed.problems.push({ where: `${file}:1`, message, fatal: true });
    return parsed;
  }

  for (const item of doc.contents.items) {
    const line = lineOf(lines, item);
    const report = (message: string, fatal: boolean, at = line) =>
      parsed.problems.push({ where: `${file}:${at}`, message, fatal });
    if (!isMap(item)) {
      report(`a constellation must be a mapping with ${KEYS.join(', ')}`, true);
      continue;
    }
    const data = item.toJSON() as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (!KEYS.includes(key)) report(`unknown key \`${key}\``, false);
    }
    const name = localised(data.name, 'name', report);
    const reasoning = localised(data.reasoning, 'reasoning', report);
    const size = data.size as Size;
    if (!SIZES.includes(size)) report(`\`size\` must be one of ${SIZES.join(', ')}`, true);
    const energy = data.energy as Energy;
    if (!ENERGIES.includes(energy))
      report(`\`energy\` must be one of ${ENERGIES.join(', ')}`, true);

    const issues: Entry['issues'] = [];
    const list = item.get('issues', true);
    if (!isSeq(list) || !list.items.length) {
      report('`issues` must list at least one issue number', true);
    } else {
      for (const node of list.items) {
        const value = isScalar(node) ? node.value : undefined;
        const at = lineOf(lines, node);
        if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
          issues.push({ number: value, line: at });
        } else {
          report(
            `\`issues\` holds ${JSON.stringify(value ?? null)}, not an issue number`,
            true,
            at,
          );
        }
      }
    }
    parsed.entries.push({ line, name, reasoning, size, energy, issues });
  }
  return parsed;
}

/** Reads a constellations file against the question cache; a missing file holds none. */
export function loadConstellations(file: string, questions: Questions): Constellations {
  const { entries, problems } = parse(file);
  const fatal = problems.filter((p) => p.fatal);
  if (fatal.length) {
    const list = fatal.map((p) => `  ${p.where}: ${p.message}`).join('\n');
    throw new Error(`${file} cannot be read; run \`bun run check:constellations\`:\n${list}`);
  }
  const byNumber = new Map<number, Constellation>();
  const all: Constellation[] = [];
  for (const { name, reasoning, size, energy, issues } of entries) {
    const constellation: Constellation = { name, reasoning, size, energy, questions: [] };
    for (const { number } of issues) {
      const question = questions.get(number);
      if (question?.state !== 'open' || byNumber.has(number)) continue;
      byNumber.set(number, constellation);
      constellation.questions.push(question);
    }
    if (constellation.questions.length) all.push(constellation);
  }
  const ungrouped = questions.all().filter((q) => q.state === 'open' && !byNumber.has(q.number));
  return {
    all: () => [...all],
    of: (n) => byNumber.get(n),
    ungrouped: () => [...ungrouped],
  };
}

/** The repo's constellations against the repo's question cache. */
export function getConstellations(questions: Questions = getQuestions()): Constellations {
  return loadConstellations(join(process.cwd(), CONSTELLATIONS_FILE), questions);
}

/**
 * The strict check, run by `bun run verify` but not by the deploy: the file is well formed,
 * every constellation has every locale's name and reasoning, and every issue it names is an
 * open question issue named only once.
 */
export function constellationProblems(
  file: string,
  questions: Questions,
  lookup: IssueLookup = () => undefined,
): Problem[] {
  const parsed = parse(file);
  const problems: Problem[] = parsed.problems.map(({ where, message }) => ({ where, message }));
  const seen = new Map<number, Entry>();
  for (const entry of parsed.entries) {
    for (const { number, line } of entry.issues) {
      const where = `${file}:${line}`;
      const first = seen.get(number);
      if (first) {
        problems.push({
          where,
          message: `#${number} is named twice; it is already in "${first.name.en}" (line ${first.line})`,
        });
        continue;
      }
      seen.set(number, entry);
      const question = questions.get(number);
      if (question?.state === 'closed') {
        problems.push({ where, message: `#${number} is closed; remove it` });
      } else if (!question) {
        const found = lookup(number);
        const message =
          found === 'missing'
            ? `#${number} does not exist`
            : found === 'not-question'
              ? `#${number} has no kind:open or kind:conflict label`
              : `#${number} is not a question issue in ${QUESTION_CACHE}/ (missing, or without a kind:open or kind:conflict label; run \`bun run pull\`)`;
        problems.push({ where, message });
      }
    }
  }
  return problems.sort((a, b) => lineNumber(a) - lineNumber(b));
}

function lineNumber(problem: Problem): number {
  return Number(/:(\d+)$/.exec(problem.where)?.[1] ?? 0);
}
