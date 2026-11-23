/**
 * The constellations view: a brass dial. Sectors are the areas, rings are energy (low near
 * the hub, high at the rim), and each open constellation is one mark in the sector of its
 * main area, on its energy ring. Angles are degrees clockwise from the top.
 */
import { AREAS } from '../lib/areas';
import type { Area } from '../lib/questions';
import { ENERGIES, type Energy, type Size } from '../lib/questions/constellation-format';
import { useTranslations } from '../i18n/ui';
import { type ChartConstellation, openConstellations, type StarChart, starsOf } from './chart';
import { type Box, mulberry32, overlapArea } from './sky';
import { isCjk, textWidth, wrapText } from './text';

export interface DialSector {
  /** Undefined for the sector of questions with no area, drawn only when needed. */
  area?: Area;
  start: number;
  end: number;
  /** How many constellations sit in it. */
  count: number;
}

export interface DialMark {
  number: number;
  /** The main area: the one holding most of its questions, ties to the wiki's first. */
  area?: Area;
  /** Every area its questions are in, the main one first, then by how many it holds. */
  areas: Area[];
  energy?: Energy;
  angle: number;
  /** The mark's centre and radius; a larger constellation has a larger mark. */
  x: number;
  y: number;
  r: number;
  label: DialLabel;
}

/** A name in lines; `x` is where the anchor sits, `y` the top of the first line. */
export interface DialLabel {
  lines: string[];
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  box: Box;
  /** A thin line from the mark to a name set further off. */
  leader?: { x1: number; y1: number; x2: number; y2: number };
}

export interface DialRing {
  /** Undefined for the ring of constellations with no energy, drawn only when needed. */
  energy?: Energy;
  r: number;
  /** Where the ring's energy is engraved, on the rule at the top, reading upwards. */
  labelBox: Box;
}

export interface DialLayout {
  /** The dial's width and height, and the centre of the hub. */
  size: number;
  centre: number;
  hub: number;
  /** The plate the rings are engraved on; the area band and the limb lie outside it. */
  plate: number;
  band: number;
  limb: number;
  rings: DialRing[];
  /** Half the angle kept clear at the top for the rule that carries the energy scale. */
  rule: number;
  sectors: DialSector[];
  marks: DialMark[];
}

const SIZE = 1000;
const CENTRE = SIZE / 2;
const HUB = 88;
const PLATE = 444;
const BAND = 476;
const LIMB = 498;
const RING_RADIUS = { none: 116, low: 178, medium: 270, high: 362 };
const MARK_RADIUS: Record<Size, number> = { small: 8, medium: 11, large: 14 };
const LABEL_SIZE = 16;
export const LABEL_LINE = 19;
const LABEL_WIDTH = 128;
const LABEL_GAP = 5;
/** The energy names on the rule: how far along it each reaches, and how wide it is. */
const RING_LABEL_REACH = 30;
const RING_LABEL_HALF = 10;
/** Area names on the band: capitals with wide letter spacing, as `brass.css` sets them. */
export const BAND_NAME_SIZE = 13;
const BAND_NAME_SPACING = { latin: 0.14, cjk: 0.3 };

/** How long an area's name runs along the band, with a little room either side. */
function bandNameWidth(name: string): number {
  const cjk = isCjk(name);
  const spacing = (cjk ? BAND_NAME_SPACING.cjk : BAND_NAME_SPACING.latin) * BAND_NAME_SIZE;
  return textWidth(name.toUpperCase(), BAND_NAME_SIZE) + [...name].length * spacing + 18;
}

/** The narrowest sector, for an area with no constellations, in constellations' worth. */
const EMPTY_WEIGHT = 0.55;

/** A point on the dial, from an angle clockwise from the top. */
export function polar(r: number, angle: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  return { x: CENTRE + r * Math.sin(a), y: CENTRE - r * Math.cos(a) };
}

/** A constellation's areas, the most held first; a tie goes to the area first in the wiki. */
function areasOf(c: ChartConstellation, chart: StarChart): (Area | undefined)[] {
  const byNumber = new Map(chart.stars.map((s) => [s.number, s]));
  const counts = new Map<Area | undefined, number>();
  for (const n of starsOf(c)) {
    const area = byNumber.get(n)!.question.area;
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  const order = (a: Area | undefined) => (a ? AREAS.indexOf(a) : AREAS.length);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || order(a) - order(b));
}

export function layoutBrass(chart: StarChart): DialLayout {
  const placed = openConstellations(chart).map((c) => ({
    c,
    areas: areasOf(c, chart),
  }));
  const main = (p: (typeof placed)[number]) => p.areas[0];
  const hasNoArea = placed.some((p) => main(p) === undefined);
  const areas: (Area | undefined)[] = [...AREAS, ...(hasNoArea ? [undefined] : [])];

  const noEnergy = placed.some((p) => !p.c.energy);
  const inArea = new Map(areas.map((a) => [a, placed.filter((p) => main(p) === a)]));
  // A sector widens with its constellations and with the most it holds on one ring.
  const crowd = (here: typeof placed) =>
    Math.max(
      0,
      ...[undefined, ...ENERGIES].map((e) => here.filter((p) => p.c.energy === e).length),
    );
  const weights = areas.map((a) => {
    const here = inArea.get(a)!;
    return here.length ? (here.length + crowd(here)) / 2 : EMPTY_WEIGHT;
  });
  // The rule is wide enough that a mark on the innermost ring keeps clear of its names.
  const inner = noEnergy ? RING_RADIUS.none : RING_RADIUS.low;
  const rule = (Math.atan((RING_LABEL_HALF + MARK_RADIUS.large + 4) / inner) * 180) / Math.PI;
  const t = useTranslations(chart.locale);
  const middle = (PLATE + BAND) / 2;
  const least = areas.map(
    (a) => (bandNameWidth(a ? (t.areaNames[a] ?? a) : t.noArea) / middle) * (180 / Math.PI),
  );
  const angles = share(360 - 2 * rule, weights, least);
  const sectors: DialSector[] = [];
  let start = rule;
  for (const [i, area] of areas.entries()) {
    const end = i === areas.length - 1 ? 360 - rule : start + angles[i];
    const sector: DialSector = { start, end, count: inArea.get(area)!.length };
    if (area) sector.area = area;
    sectors.push(sector);
    start = end;
  }

  const rings: DialRing[] = [
    ...(noEnergy ? [{ r: RING_RADIUS.none }] : []),
    ...ENERGIES.map((energy) => ({ energy, r: RING_RADIUS[energy] })),
  ].map((ring) => ({
    ...ring,
    labelBox: {
      x1: CENTRE - RING_LABEL_HALF,
      y1: CENTRE - ring.r - RING_LABEL_REACH,
      x2: CENTRE + RING_LABEL_HALF,
      y2: CENTRE - ring.r + RING_LABEL_REACH,
    },
  }));

  const marks: Omit<DialMark, 'label'>[] = [];
  const names = new Map(openConstellations(chart).map((c) => [c.number, c.name]));
  for (const [i, area] of areas.entries()) {
    const sector = sectors[i];
    for (const ring of rings) {
      const cell = inArea.get(area)!.filter((p) => p.c.energy === ring.energy);
      for (const [k, p] of cell.entries()) {
        const angle = sector.start + ((k + 0.5) * (sector.end - sector.start)) / cell.length;
        const mark: Omit<DialMark, 'label'> = {
          number: p.c.number,
          areas: p.areas.filter((a): a is Area => a !== undefined),
          angle,
          ...polar(ring.r, angle),
          r: MARK_RADIUS[p.c.size ?? 'medium'],
        };
        if (area) mark.area = area;
        if (ring.energy) mark.energy = ring.energy;
        marks.push(mark);
      }
    }
  }
  marks.sort((a, b) => a.number - b.number);
  const labels = placeLabels(
    marks,
    names,
    rings.map((r) => r.labelBox),
  );
  return {
    size: SIZE,
    centre: CENTRE,
    hub: HUB,
    plate: PLATE,
    band: BAND,
    limb: LIMB,
    rings,
    rule,
    sectors,
    marks: marks.map((m) => ({ ...m, label: labels.get(m.number)! })),
  };
}

/** Splits a total in proportion to the weights, giving each part at least its least. */
function share(total: number, weights: number[], least: number[]): number[] {
  const fixed = new Set<number>();
  for (;;) {
    const room = total - [...fixed].reduce((s, i) => s + least[i], 0);
    const free = weights.reduce((s, w, i) => (fixed.has(i) ? s : s + w), 0);
    const parts = weights.map((w, i) => (fixed.has(i) ? least[i] : (w * room) / free));
    const short = parts.findIndex((p, i) => !fixed.has(i) && p < least[i]);
    if (short < 0) return parts;
    fixed.add(short);
  }
}

/**
 * A name in lines no wider than a label. Chinese splits into lines of nearly equal length, a
 * line ending after punctuation when that keeps them within a character of even.
 */
function wrapName(name: string): string[] {
  if (!isCjk(name)) return wrapText(name, LABEL_SIZE, LABEL_WIDTH);
  const chars = [...name];
  const count = Math.ceil(textWidth(name, LABEL_SIZE) / LABEL_WIDTH);
  const lines: string[] = [];
  let at = 0;
  for (let left = count; left > 0; left--) {
    let end = left === 1 ? chars.length : at + Math.ceil((chars.length - at) / left);
    if (left > 1) {
      if (/[，、？：；。！]/.test(chars[end - 2] ?? '')) end--;
      else if (/[，、？：；。！）]/.test(chars[end] ?? '')) end++;
    }
    lines.push(chars.slice(at, end).join(''));
    at = end;
  }
  return lines.filter(Boolean);
}

/** Names keep a little air between them. */
const padded = (b: Box): Box => ({ x1: b.x1 - 3, y1: b.y1 - 2, x2: b.x2 + 3, y2: b.y2 + 2 });

/** Every place a name could sit beside its mark, the outward side first. */
function spots(m: Omit<DialMark, 'label'>, lines: string[]): DialLabel[] {
  const w = Math.max(...lines.map((l) => textWidth(l, LABEL_SIZE)));
  const h = lines.length * LABEL_LINE;
  const out: { label: DialLabel; dx: number; dy: number }[] = [];
  const add = (anchor: DialLabel['anchor'], x1: number, y1: number, far: boolean) => {
    const x = anchor === 'start' ? x1 : anchor === 'end' ? x1 + w : x1 + w / 2;
    const box = { x1, y1, x2: x1 + w, y2: y1 + h };
    const label: DialLabel = { lines, x, y: y1, anchor, box };
    if (far) {
      const to = {
        x: Math.max(box.x1 - 2, Math.min(m.x, box.x2 + 2)),
        y: Math.max(box.y1 - 2, Math.min(m.y, box.y2 + 2)),
      };
      const d = Math.hypot(to.x - m.x, to.y - m.y) || 1;
      label.leader = {
        x1: m.x + ((to.x - m.x) * (m.r + 2)) / d,
        y1: m.y + ((to.y - m.y) * (m.r + 2)) / d,
        x2: to.x,
        y2: to.y,
      };
    }
    out.push({
      label,
      dx: (box.x1 + box.x2) / 2 - m.x,
      dy: (box.y1 + box.y2) / 2 - m.y,
    });
  };
  const reach = m.r + LABEL_GAP;
  for (const push of [0, 8, 16, 26, 38, 52, 68]) {
    const far = push > 16;
    for (const shift of [0, -0.2, 0.2, -0.4, 0.4, -0.6, 0.6, -0.8, 0.8, -1, 1]) {
      const top = m.y - h / 2 + shift * (h / 2 + m.r);
      add('start', m.x + reach + push, top, far);
      add('end', m.x - reach - push - w, top, far);
      const left = m.x - w / 2 + shift * (w / 2);
      add('middle', left, m.y - reach - push - h, far);
      add('middle', left, m.y + reach + push, far);
    }
  }
  // Outward first, then the nearer spots.
  const ox = m.x - CENTRE;
  const oy = m.y - CENTRE;
  const ranked = out.map((s) => ({
    label: s.label,
    cost: Math.hypot(s.dx, s.dy) * 0.4 - (s.dx * ox + s.dy * oy) / Math.hypot(ox, oy || 1) / 4,
  }));
  ranked.sort((a, b) => a.cost - b.cost);
  return ranked.map((s) => s.label);
}

function placeLabels(
  marks: Omit<DialMark, 'label'>[],
  names: Map<number, string>,
  reserved: Box[],
): Map<number, DialLabel> {
  const blocked = [
    ...marks.map((m) => ({
      x1: m.x - m.r - 3,
      y1: m.y - m.r - 3,
      x2: m.x + m.r + 3,
      y2: m.y + m.r + 3,
    })),
    ...reserved,
  ];
  const offDial = (b: Box) => {
    const corners = [
      [b.x1, b.y1],
      [b.x2, b.y1],
      [b.x1, b.y2],
      [b.x2, b.y2],
    ];
    if (corners.some(([x, y]) => Math.hypot(x - CENTRE, y - CENTRE) > PLATE - 6)) return true;
    const nx = Math.max(b.x1, Math.min(CENTRE, b.x2));
    const ny = Math.max(b.y1, Math.min(CENTRE, b.y2));
    return Math.hypot(nx - CENTRE, ny - CENTRE) < HUB + 6;
  };
  // Each spot's clash with the marks is fixed, so it is counted once.
  const options = new Map(
    marks.map((m) => {
      const lines = wrapName(names.get(m.number)!);
      const every = spots(m, lines);
      const on = every.filter((l) => !offDial(l.box));
      const list = on.length ? on : every;
      return [
        m.number,
        list.map((label, rank) => ({
          label,
          base: rank * 0.5 + blocked.reduce((c, b) => c + overlapArea(label.box, b) * 50, 0),
        })),
      ];
    }),
  );
  type Spot = { label: DialLabel; base: number };
  const cost = (placed: Map<number, Spot>, n: number, spot: Spot) => {
    let c = spot.base;
    for (const [other, s] of placed)
      if (other !== n) c += overlapArea(spot.label.box, padded(s.label.box)) * 50;
    return c;
  };
  const best = (placed: Map<number, Spot>, n: number) => {
    let pick = options.get(n)![0];
    let low = Infinity;
    for (const spot of options.get(n)!) {
      const c = cost(placed, n, spot);
      if (c < low) [pick, low] = [spot, c];
    }
    return pick;
  };
  const clashes = (placed: Map<number, Spot>, n: number) => {
    const spot = placed.get(n)!;
    return cost(placed, n, spot) - options.get(n)!.indexOf(spot) * 0.5;
  };
  const attempt = (order: number[]) => {
    const placed = new Map<number, Spot>();
    for (const n of order) placed.set(n, best(placed, n));
    // A name that still clashes moves to its best spot among the others, a few times.
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (const n of order) {
        if (clashes(placed, n) < 0.01) continue;
        const pick = best(placed, n);
        if (pick !== placed.get(n)) {
          placed.set(n, pick);
          moved = true;
        }
      }
      if (!moved) break;
    }
    let total = 0;
    for (const n of order) total += cost(placed, n, placed.get(n)!);
    return { placed, total };
  };

  // The most crowded marks choose first; if names still clash, other orders are tried.
  const crowd = (m: Omit<DialMark, 'label'>) =>
    marks.filter((o) => Math.hypot(o.x - m.x, o.y - m.y) < 170).length;
  let order = [...marks]
    .sort((a, b) => crowd(b) - crowd(a) || a.number - b.number)
    .map((m) => m.number);
  let result = attempt(order);
  const rnd = mulberry32(7);
  for (
    let tries = 0;
    tries < 40 && marks.some((m) => clashes(result.placed, m.number) >= 0.01);
    tries++
  ) {
    order = [...order].sort(() => rnd() - 0.5);
    const next = attempt(order);
    if (next.total < result.total) result = next;
  }
  return new Map([...result.placed].map(([n, s]) => [n, s.label]));
}
