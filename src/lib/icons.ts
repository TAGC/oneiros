import data from '../data/icons.json';

export type IconGrid = (string | null)[][];

/** 24×24 pixel icons, keyed by area name or a page's `icon` override. */
export const ICONS = data as Record<string, IconGrid>;

export const ICON_NAMES = Object.keys(ICONS) as [string, ...string[]];

export function hasIcon(name: string): boolean {
  return Object.hasOwn(ICONS, name);
}
