import { readdirSync } from 'node:fs';
import data from '../data/icons.json';

export type IconGrid = (string | null)[][];

/** 24×24 pixel icons, keyed by area name or a page's `icon` override. */
export const ICONS = data as Record<string, IconGrid>;

export const ICON_NAMES = Object.keys(ICONS) as [string, ...string[]];

/**
 * Painted icons, read from the files `bun run icons` builds into public/icons/ from
 * art-src/icons/: `items-512.webp` paints the icon named Items. The files are the only
 * record, so adding a master and rebuilding is enough.
 */
const PAINTED_DIR = 'public/icons';
const painted = new Set(
  readdirSync(PAINTED_DIR)
    .filter((f) => f.endsWith('-512.webp'))
    .map((f) => f.replace(/-512\.webp$/, '')),
);

/** A painted icon replaces the pixel icon of the same name. */
export function isPainted(name: string): boolean {
  return painted.has(name.toLowerCase());
}

export function hasIcon(name: string): boolean {
  return Object.hasOwn(ICONS, name) || isPainted(name);
}
