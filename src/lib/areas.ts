import glossary from '../data/sheet/glossary.json';

const table = glossary.blocks.find((b) => b.type === 'table');
const column = table?.header?.indexOf('Area') ?? -1;

/** The Glossary's Area values, A to Z. */
export const AREAS = [
  ...new Set((table?.rows ?? []).map((row) => String(row[column] ?? '').trim()).filter(Boolean)),
].sort() as [string, ...string[]];

/** Areas with a pixel icon in `src/data/icons.json`. */
export const ICON_AREAS = ['Memory', 'Beliefs', 'Temenos', 'Magic'];

/** Areas listed in the sidebar, as in the approved mockup. */
export const SIDEBAR_AREAS = [
  'Character',
  'Memory',
  'Beliefs',
  'Temenos',
  'Magic',
  'World',
  'Economy',
];
