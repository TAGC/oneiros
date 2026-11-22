/**
 * The night sky's background specks, merged into a few paths. Thousands of single circles
 * made the sky slow to paint; one path per opacity step (and per twinkle rhythm) draws the
 * same specks with a handful of elements. Each path spans the whole sky, so it takes its
 * opacity as fill-opacity, which needs no layer of its own.
 */
import { mulberry32 } from './sky';

export interface Speck {
  x: number;
  y: number;
  r: number;
  /** Opacity, 0.25 to 1. */
  o: number;
  /** Twinkle rhythm, for one speck in nine: seconds per cycle and start offset. */
  tw?: { period: number; delay: number };
}

export interface SpeckPath {
  d: string;
  opacity: number;
  tw?: { period: number; delay: number };
}

const round = (v: number, digits: number) => Number(v.toFixed(digits));

/** The specks over the sky and the margin the view can zoom out into, seeded so every build matches. */
export function scatterSpecks(width: number, height: number, pad: number): Speck[] {
  const random = mulberry32(7);
  const count = Math.round(((width + 2 * pad) * (height + 2 * pad)) / 4500);
  return Array.from({ length: count }, (_, i) => {
    const speck: Speck = {
      x: round(-pad + random() * (width + 2 * pad), 1),
      y: round(-pad + random() * (height + 2 * pad), 1),
      r: round(0.35 + random() * random() * 1.3, 2),
      o: round(0.25 + random() * 0.75, 2),
    };
    if (i % 9 === 0) speck.tw = { period: 3 + (i % 5), delay: i % 7 };
    return speck;
  });
}

/** A circle as path data: two half arcs. */
export function circlePath({ x, y, r }: Pick<Speck, 'x' | 'y' | 'r'>): string {
  return `M${round(x - r, 2)} ${y}a${r} ${r} 0 1 0 ${round(2 * r, 2)} 0a${r} ${r} 0 1 0 ${round(-2 * r, 2)} 0`;
}

/** Opacity steps for still specks; finer than the eye tells apart at speck size. */
export const OPACITY_STEP = 0.05;

/**
 * Still specks go into one path per opacity step. Twinkling specks go into one path per
 * rhythm, whose opacity the twinkle animates; at rest it shows their mean opacity.
 */
export function speckPaths(specks: Speck[]): SpeckPath[] {
  const still = new Map<number, string[]>();
  const twinkling = new Map<string, { tw: Speck['tw'] & {}; parts: string[]; o: number[] }>();
  for (const s of specks) {
    if (s.tw) {
      const key = `${s.tw.period}/${s.tw.delay}`;
      const group = twinkling.get(key) ?? { tw: s.tw, parts: [], o: [] };
      group.parts.push(circlePath(s));
      group.o.push(s.o);
      twinkling.set(key, group);
    } else {
      const step = round(Math.round(s.o / OPACITY_STEP) * OPACITY_STEP, 2);
      const parts = still.get(step) ?? [];
      parts.push(circlePath(s));
      still.set(step, parts);
    }
  }
  const paths: SpeckPath[] = [...still]
    .sort(([a], [b]) => a - b)
    .map(([opacity, parts]) => ({ d: parts.join(''), opacity }));
  for (const { tw, parts, o } of twinkling.values()) {
    const mean = o.reduce((sum, v) => sum + v, 0) / o.length;
    paths.push({ d: parts.join(''), opacity: round(mean, 2), tw });
  }
  return paths;
}
