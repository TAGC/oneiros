import type { Area } from '../lib/questions';
import { slugify } from '../lib/site';

const mix = (a: string, b: string) => `color-mix(in srgb, var(--${a}), var(--${b}))`;

/** Each area's glow, from the eight emotion colours and their blends. */
const AREA_TINTS: Record<Area, string> = {
  Beliefs: 'var(--courage)',
  Body: mix('love', 'courage'),
  Character: 'var(--joy)',
  Dreams: 'var(--despair)',
  Economy: 'var(--hope)',
  Emotion: 'var(--love)',
  Items: mix('joy', 'hope'),
  Library: mix('grief', 'despair'),
  Lore: mix('hope', 'hate'),
  Lucidity: 'var(--fear)',
  Magic: mix('despair', 'love'),
  Memory: 'var(--grief)',
  Philosophy: mix('courage', 'despair'),
  Rest: mix('fear', 'grief'),
  Temenos: 'var(--hate)',
  World: mix('hate', 'fear'),
};

export function areaTint(area: Area | undefined): string {
  return area ? AREA_TINTS[area] : 'var(--mute)';
}

/** A stable key for ids and classes; questions with no area get `none`. */
export function areaKey(area: Area | undefined): string {
  return area ? slugify(area) : 'none';
}
