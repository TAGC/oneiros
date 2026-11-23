/**
 * The constellation milestone format of docs/constellations.md: the title is the mark and the
 * English name; the description is the Size and Energy table, then `## en` with the reasoning
 * and `## zh` with `### <Chinese name>` and the reasoning. The one place that writes, reads and
 * validates it: reading a written constellation gives the same constellation.
 */
import { DEFAULT_LOCALE, LANGUAGE, LOCALES, type Locale } from '../../i18n/locale';
import { propertyRow, splitSections, TITLE, tableRows } from '.';

/** A milestone is a constellation when its title starts with this mark. */
export const CONSTELLATION_MARK = '✦ ';

/** How long a constellation takes to settle; labels in `ui.ts` (`constellationSizes`). */
export const SIZES = ['small', 'medium', 'large'] as const;
/** How much energy a constellation needs; labels in `ui.ts` (`constellationEnergies`). */
export const ENERGIES = ['low', 'medium', 'high'] as const;

export type Size = (typeof SIZES)[number];
export type Energy = (typeof ENERGIES)[number];

/** A milestone's text as GitHub holds it. */
export interface MilestoneText {
  title: string;
  description: string;
}

/** What a constellation's milestone says; Size and Energy are lowercase when on their scale. */
export interface ConstellationText {
  name: Partial<Record<Locale, string>>;
  reasoning: Partial<Record<Locale, string>>;
  size?: string;
  energy?: string;
}

/** The value on the scale, ignoring case, or undefined. */
export function onScale<T extends string>(
  scale: readonly T[],
  value: string | undefined,
): T | undefined {
  return scale.find((s) => s === value?.toLowerCase());
}

const label = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

/** The milestone title and description for a constellation. */
export function writeConstellation(c: ConstellationText): MilestoneText {
  const sections = LOCALES.map((locale) => {
    const name = c.name[locale]?.trim();
    const heading = locale !== DEFAULT_LOCALE && name ? `### ${name}\n\n` : '';
    return `## ${locale}\n\n${heading}${c.reasoning[locale]?.trim() ?? ''}`;
  });
  const table = `| Property | Value |\n|---|---|\n| Size | ${label(c.size)} |\n| Energy | ${label(c.energy)} |`;
  return {
    title: CONSTELLATION_MARK + (c.name[DEFAULT_LOCALE]?.trim() ?? ''),
    description: [table, ...sections].join('\n\n'),
  };
}

/** The constellation a milestone holds, or undefined when its title has no mark. */
export function readConstellation(m: MilestoneText): ConstellationText | undefined {
  if (!m.title.startsWith(CONSTELLATION_MARK)) return undefined;
  const { lead, sections } = splitSections(m.description, 2, LOCALES);
  const rows = tableRows(lead);
  const c: ConstellationText = {
    name: { [DEFAULT_LOCALE]: m.title.slice(CONSTELLATION_MARK.length).trim() },
    reasoning: {},
  };
  for (const locale of LOCALES) {
    let text = sections[locale];
    if (text === undefined) continue;
    if (locale !== DEFAULT_LOCALE) {
      const [first, ...rest] = text.split('\n');
      const heading = TITLE.exec(first);
      if (heading) {
        c.name[locale] = heading[1];
        text = rest.join('\n').trim();
      }
    }
    if (text) c.reasoning[locale] = text;
  }
  const size = propertyRow(rows, 'size');
  const energy = propertyRow(rows, 'energy');
  if (size !== undefined) c.size = onScale(SIZES, size) ?? size;
  if (energy !== undefined) c.energy = onScale(ENERGIES, energy) ?? energy;
  return c;
}

/**
 * What breaks the format: a Size or Energy missing or off its scale, or a missing name or
 * reasoning in a language. `bun run check` and the plan helper both report these.
 */
export function formatProblems(c: ConstellationText): string[] {
  const problems: string[] = [];
  for (const [property, scale, value] of [
    ['Size', SIZES, c.size],
    ['Energy', ENERGIES, c.energy],
  ] as const) {
    const list = scale.join(', ');
    if (value === undefined) problems.push(`no ${property}; use one of ${list}`);
    else if (!onScale(scale, value)) problems.push(`${property} "${value}" is not one of ${list}`);
  }
  for (const field of ['name', 'reasoning'] as const) {
    for (const locale of LOCALES) {
      if (!c[field]?.[locale]?.trim()) problems.push(`no ${LANGUAGE[locale]} ${field}`);
    }
  }
  return problems;
}

const NUMBER = String.raw`(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)`;
const COUNTS = [
  new RegExp(String.raw`\bboth\b`, 'gi'),
  new RegExp(String.raw`\ball (?:of )?(?:the )?${NUMBER}\b`, 'gi'),
  new RegExp(
    String.raw`\b${NUMBER} (?:questions?|conflicts?|issues?|of them|of these|are|ask)\b`,
    'gi',
  ),
  /[两二三四五六七八九十]+[个项道者]|\d+\s*[个项道]/g,
];

/**
 * Phrases in a reasoning that look like counts ("both", "all four", 两个), which go stale as
 * questions close and move. A hint for the plan helper's warnings, not a format rule.
 */
export function statedCounts(text: string): string[] {
  const found = COUNTS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((m) => ({ at: m.index, phrase: m[0] })),
  );
  return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.phrase))];
}
