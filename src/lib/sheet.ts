export interface SheetTableBlock {
  type: 'table';
  header: string[];
  rows: unknown[][];
}

export interface SheetNotesBlock {
  type: 'notes';
  items: string[];
}

export type SheetBlock = SheetTableBlock | SheetNotesBlock;

export interface SheetTab {
  slug: string;
  name: string;
  blocks: SheetBlock[];
}

const files = import.meta.glob<{ default: { name: string; blocks: SheetBlock[] } }>(
  '../data/sheet/*.json',
  { eager: true },
);
const index = files['../data/sheet/_index.json'].default as unknown as {
  slug: string;
  name: string;
}[];

/** Every sheet tab in sheet order. */
export const TABS: SheetTab[] = index
  .filter((t) => files[`../data/sheet/${t.slug}.json`])
  .map((t) => ({ ...t, blocks: files[`../data/sheet/${t.slug}.json`].default.blocks }));

export function getTab(slug: string): SheetTab {
  const tab = TABS.find((t) => t.slug === slug);
  if (!tab) throw new Error(`Sheet tab "${slug}" not found in src/data/sheet/`);
  return tab;
}

export function isArchive(tab: SheetTab): boolean {
  return tab.slug.startsWith('archive-');
}

/** A tab's display name: `Archive_ essences` reads as `Archive: essences`. */
export function tabTitle(tab: SheetTab): string {
  return tab.name.replace(/^Archive_\s*/, 'Archive: ');
}

export function shortTitle(tab: SheetTab): string {
  const name = tab.name.replace(/^Archive_\s*/, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function cellText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

const NUMERIC = /^[-−+]?(?:×\s?)?[\d.,]+\s?(?:%|×)?$/;

export function isNumeric(text: string): boolean {
  return NUMERIC.test(text.trim());
}
