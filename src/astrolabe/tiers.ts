/**
 * The tiers view: a working map. Columns run from settled ground through the frontier to
 * one, two, and three or more steps out; rows are the areas, or the constellations. A step
 * out is the longest chain of unsettled blockers in front of a question.
 */
import type { Locale } from '../i18n/ui';
import type { Area } from '../lib/questions';
import type { ChartConstellation, Star, StarChart, Thread } from './chart';
import type { Box, Clustering } from './sky';
import { starRadius } from './sky';
import { textWidth, wrapText } from './text';

/** 0 settled ground, 1 frontier, 2 one step out, 3 two steps out, 4 three or more. */
export type Tier = 0 | 1 | 2 | 3 | 4;

export interface TierColumn {
  tier: Tier;
  x: number;
  width: number;
}

/** An area's row, or a constellation's; by constellation, the last row holds the rest. */
export interface TierRow {
  area?: Area;
  constellation?: number;
  /** A finished constellation's row, holding settled questions. */
  finished?: boolean;
  /** A constellation's name, wrapped to the name column. */
  name?: { lines: string[]; lang: Locale };
  y: number;
  height: number;
}

export interface TierStar {
  number: number;
  tier: Tier;
  /** The glyph's centre and reach. */
  x: number;
  y: number;
  r: number;
  label: { lines: string[]; x: number; y: number; box: Box };
}

export interface TierThread extends Thread {
  d: string;
}

export interface TiersLayout {
  by: Clustering;
  width: number;
  height: number;
  /** Where the column headings sit, above the first row. */
  headerHeight: number;
  /** The width of the row names at the left of each row. */
  areaWidth: number;
  columns: TierColumn[];
  rows: TierRow[];
  stars: TierStar[];
  threads: TierThread[];
}

const HEADER = 58;
const AREA_WIDTH = 132;
const CONSTELLATION_WIDTH = 172;
const NAME_SIZE = 15;
const COLUMN = 214;
const TEXT_INSET = 34;
const SIZE = 13.5;
const LINE = 18;
const CELL_GAP = 12;
const ROW_PAD = 14;

/** How many unsettled blockers stand in a row in front of each open question. */
function stepsOut(chart: StarChart): Map<number, number> {
  const byNumber = new Map(chart.stars.map((s) => [s.number, s]));
  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const depth = (star: Star): number => {
    if (star.status === 'frontier') return 0;
    const known = memo.get(star.number);
    if (known !== undefined) return known;
    if (visiting.has(star.number)) return 1;
    visiting.add(star.number);
    let d = 1;
    for (const n of star.blockedBy) {
      const blocker = byNumber.get(n)!;
      if (blocker.status === 'decided' || blocker.status === 'ruled-out') continue;
      d = Math.max(d, blocker.question.status === 'open' ? depth(blocker) + 1 : 1);
    }
    visiting.delete(star.number);
    memo.set(star.number, d);
    return d;
  };
  const out = new Map<number, number>();
  for (const s of chart.stars) if (s.question.status === 'open') out.set(s.number, depth(s));
  return out;
}

function tierOf(star: Star, steps: Map<number, number>): Tier {
  if (star.question.status !== 'open') return 0;
  return Math.min(4, 1 + (steps.get(star.number) ?? 0)) as Tier;
}

function path(a: TierStar, b: TierStar, aLabelEnd: number, kind: Thread['kind']): string {
  const f = (v: number) => v.toFixed(1);
  if (b.x > a.x && kind !== 'undermines') {
    const sx = Math.min(aLabelEnd + 6, b.x - b.r - 24);
    const mid = b.x - b.r - 14;
    return `M${f(sx)},${f(a.y)}H${f(mid)}V${f(b.y)}H${f(b.x - b.r - 4)}`;
  }
  const sx = a.x - a.r - 4;
  const ex = b.label.box.x2 + 6;
  const bow = Math.max(40, Math.abs(sx - ex) * 0.3);
  return `M${f(sx)},${f(a.y)}C${f(sx - bow)},${f(a.y)} ${f(ex + bow)},${f(b.y)} ${f(ex)},${f(b.y)}`;
}

/** A constellation's row: open ones first, finished ones last, below the questions in none. */
function constellationRow(c: ChartConstellation, finished: boolean) {
  const row: Omit<TierRow, 'y' | 'height'> = {
    constellation: c.number,
    name: { lines: wrapText(c.name, NAME_SIZE, CONSTELLATION_WIDTH - 28), lang: c.nameLang },
  };
  if (finished) row.finished = true;
  return { row, stars: c.stars };
}

export function layoutTiers(chart: StarChart, by: Clustering = 'areas'): TiersLayout {
  const nameWidth = by === 'areas' ? AREA_WIDTH : CONSTELLATION_WIDTH;
  const steps = stepsOut(chart);
  const tiers = new Map(chart.stars.map((s) => [s.number, tierOf(s, steps)]));
  const deepest = Math.max(1, ...tiers.values());
  const columns: TierColumn[] = [];
  for (let t = 0; t <= deepest; t++) {
    if (t <= 1 || [...tiers.values()].includes(t as Tier)) {
      columns.push({ tier: t as Tier, x: nameWidth + columns.length * COLUMN, width: COLUMN });
    }
  }
  const columnOf = new Map(columns.map((c) => [c.tier, c]));
  const byNumber = new Map(chart.stars.map((s) => [s.number, s]));

  const rows: TierRow[] = [];
  const stars: TierStar[] = [];
  let y = HEADER;
  const groups: { row: Omit<TierRow, 'y' | 'height'>; stars: number[] }[] =
    by === 'areas'
      ? chart.areas.map((g) => ({ row: g.area ? { area: g.area } : {}, stars: g.stars }))
      : [
          ...chart.constellations.map((c) => constellationRow(c, false)),
          {
            row: {},
            stars: chart.stars
              .filter((s) => s.constellation === undefined && s.finishedIn === undefined)
              .map((s) => s.number),
          },
          ...chart.finished.map((c) => constellationRow(c, true)),
        ].filter((g) => g.stars.length);
  for (const group of groups) {
    const cells = new Map<Tier, number>();
    const placed: TierStar[] = [];
    for (const number of group.stars) {
      const star = byNumber.get(number)!;
      const tier = tiers.get(number)!;
      const column = columnOf.get(tier)!;
      const lines = wrapText(`${star.number} ${star.label}`, SIZE, column.width - TEXT_INSET - 12);
      const top = y + ROW_PAD + (cells.get(tier) ?? 0);
      const height = lines.length * LINE;
      cells.set(tier, (cells.get(tier) ?? 0) + height + CELL_GAP);
      const width = Math.max(...lines.map((l) => textWidth(l, SIZE)));
      const x1 = column.x + TEXT_INSET;
      placed.push({
        number,
        tier,
        x: column.x + 17,
        y: top + LINE / 2 + 1,
        r: Math.min(starRadius(star), 12),
        label: {
          lines,
          x: x1,
          y: top,
          box: {
            x1,
            y1: top,
            x2: Math.min(x1 + width, column.x + column.width - 4),
            y2: top + height,
          },
        },
      });
    }
    const named = (group.row.name?.lines.length ?? 1) * LINE + 38;
    const height = Math.max(
      54,
      named,
      ...[...cells.values()].map((h) => h - CELL_GAP + ROW_PAD * 2),
    );
    rows.push({ ...group.row, y, height });
    stars.push(...placed);
    y += height;
  }
  stars.sort((a, b) => a.number - b.number);
  const at = new Map(stars.map((s) => [s.number, s]));
  const threads = chart.threads.map((t) => {
    const a = at.get(t.from)!;
    const b = at.get(t.to)!;
    return { ...t, d: path(a, b, a.label.box.x2, t.kind) };
  });
  const last = columns.at(-1)!;
  return {
    width: last.x + last.width,
    height: y,
    by,
    headerHeight: HEADER,
    areaWidth: nameWidth,
    columns,
    rows,
    stars,
    threads,
  };
}
