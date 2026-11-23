/**
 * The night sky view: a seeded force layout that pulls each cluster (an area, or a
 * constellation) into its own patch of sky, settled entirely at build time, then greedy label
 * placement around each star. The same chart always gives the same sky.
 */
import { useTranslations } from '../i18n/ui';
import type { Area, Thread } from '../lib/questions';
import type { Clustering } from '../lib/questions/clusters';
import { openConstellations, type Star, type StarChart, starsOf } from './chart';
import { curve, threadBend } from './curve';
import { constellationFacts } from './facts';
import { wrapText, textWidth } from './text';

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SkyLabel {
  lines: string[];
  /** The anchor point of the first line's top edge. */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  size: number;
  lineHeight: number;
  box: Box;
}

export interface SkyStar {
  number: number;
  x: number;
  y: number;
  /** How far the glyph reaches from its centre. */
  r: number;
  label: SkyLabel;
}

/**
 * One cluster of stars: an area, or a constellation. Clustered by constellation, the stars in
 * none share a cluster with neither set.
 */
export interface SkyCluster {
  area?: Area;
  constellation?: number;
  /** The centre of the cluster's stars, and how far they spread. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  /**
   * Where its name's baseline is centred. A constellation's cluster has none here: its name is
   * the constellation's, in `SkyLayout.constellations`.
   */
  label?: { x: number; y: number; box: Box };
}

export interface SkyThread extends Thread {
  /** An SVG path from the edge of one star to the edge of the other. */
  d: string;
}

/** A constellation's lines (a shortest tree through its stars) and the place for its name. */
export interface SkyConstellation {
  number: number;
  /** Pairs of star numbers to join. */
  segments: [number, number][];
  /** The centre of the name's first line, and the box its two lines take. */
  label: { x: number; y: number; box: Box };
  /** A finished constellation, holding settled questions: drawn faint, with no facts line. */
  finished?: boolean;
}

export interface SkyLayout {
  by: Clustering;
  width: number;
  height: number;
  stars: SkyStar[];
  clusters: SkyCluster[];
  threads: SkyThread[];
  constellations: SkyConstellation[];
}

/** The glyph's reach, shared by every view: frontier stars have rays, central ones are larger. */
export function starRadius(star: Pick<Star, 'status' | 'roles'>): number {
  const base = { frontier: 10, blocked: 4.2, decided: 4, 'ruled-out': 5, undermined: 7.6 }[
    star.status
  ];
  const central = star.roles.includes('central') ? 1.5 : 1;
  const orbit = star.roles.includes('independent') ? 4 : 0;
  return base * central + orbit;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABEL_SIZE = 12.5;
const CENTRAL_SIZE = 13.5;
const LINE_HEIGHT = 15;
const AREA_SIZE = 17;
const MARGIN = 24;
const TICKS = 480;

/** The stars of one cluster, before they are placed. */
interface Group {
  area?: Area;
  constellation?: number;
  stars: number[];
}

interface Node {
  star: Star;
  group: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Half the clear space a star keeps around it, across and down. */
  hx: number;
  hy: number;
}

/** The area two boxes share; 0 when they do not overlap. */
export const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) *
  Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

function settle(chart: StarChart, nodes: Node[], anchors: { x: number; y: number }[]): void {
  const rnd = mulberry32(11);
  const index = new Map(nodes.map((n, i) => [n.star.number, i]));
  const links = chart.threads
    .map((t) => ({
      a: index.get(t.from)!,
      b: index.get(t.to)!,
      w: t.kind === 'undermines' ? 0.5 : 1,
    }))
    .filter((l) => l.a !== undefined && l.b !== undefined);
  for (let tick = 0; tick < TICKS; tick++) {
    const alpha = 0.05 + 0.95 * (1 - tick / TICKS) ** 2;
    const centres = anchors.map(() => ({ x: 0, y: 0, n: 0 }));
    for (const n of nodes) {
      const c = centres[n.group];
      c.x += n.x;
      c.y += n.y;
      c.n++;
    }
    for (const c of centres) {
      if (c.n) {
        c.x /= c.n;
        c.y /= c.n;
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = rnd() - 0.5;
          dy = rnd() - 0.5;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const k = a.group === b.group ? 1600 : 5200;
        const f = Math.min(k / d2, 12);
        a.vx -= (dx / d) * f;
        a.vy -= (dy / d) * f;
        b.vx += (dx / d) * f;
        b.vy += (dy / d) * f;
      }
    }
    for (const l of links) {
      const a = nodes[l.a];
      const b = nodes[l.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const target = a.group === b.group ? 90 : 150;
      const f = (d - target) * 0.03 * l.w;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      const c = centres[n.group];
      const anchor = anchors[n.group];
      n.vx += (c.x - n.x) * 0.03 + (anchor.x - n.x) * 0.012;
      n.vy += (c.y - n.y) * 0.03 + (anchor.y - n.y) * 0.012;
      n.vx *= 0.55;
      n.vy *= 0.55;
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
    }
    collide(nodes);
  }
  for (let pass = 0; pass < 20; pass++) collide(nodes);
}

/** Pushes apart stars whose clear spaces (ellipses, wider than tall) overlap. */
function collide(nodes: Node[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const gap = a.group === b.group ? 1 : 1.3;
      const sx = (a.hx + b.hx) * gap;
      const sy = (a.hy + b.hy) * gap;
      const dx = (b.x - a.x) / sx;
      const dy = (b.y - a.y) / sy;
      const d = Math.hypot(dx, dy);
      if (d >= 1) continue;
      const push = d === 0 ? 0.5 : ((1 - d) / d) * 0.5;
      const ux = d === 0 ? 0.5 : dx;
      const uy = d === 0 ? 0 : dy;
      a.x -= ux * push * sx;
      a.y -= uy * push * sy;
      b.x += ux * push * sx;
      b.y += uy * push * sy;
    }
  }
}

/**
 * Seats each cluster in a grid cell so clusters with many threads between them sit side by
 * side: a deterministic swap search that shortens the total length of the threads between them.
 */
function seatClusters(chart: StarChart, clusters: Group[], cols: number, cells: number): number[] {
  const groups = clusters.length;
  const groupOf = new Map<number, number>();
  clusters.forEach((g, i) => g.stars.forEach((n) => groupOf.set(n, i)));
  const weight = Array.from({ length: groups }, () => Array<number>(groups).fill(0));
  for (const t of chart.threads) {
    const a = groupOf.get(t.from)!;
    const b = groupOf.get(t.to)!;
    if (a !== b) {
      weight[a][b]++;
      weight[b][a]++;
    }
  }
  const seat = Array.from({ length: groups }, (_, i) => i);
  const distance = (p: number, q: number) =>
    Math.hypot((p % cols) - (q % cols), Math.floor(p / cols) - Math.floor(q / cols));
  const cost = () => {
    let total = 0;
    for (let a = 0; a < groups; a++) {
      for (let b = a + 1; b < groups; b++) total += weight[a][b] * distance(seat[a], seat[b]);
    }
    return total;
  };
  let best = cost();
  for (let improved = true; improved;) {
    improved = false;
    for (let a = 0; a < groups; a++) {
      for (let cell = 0; cell < cells; cell++) {
        const b = seat.indexOf(cell);
        const from = seat[a];
        if (from === cell) continue;
        seat[a] = cell;
        if (b >= 0) seat[b] = from;
        const next = cost();
        if (next < best - 1e-9) {
          best = next;
          improved = true;
        } else {
          seat[a] = from;
          if (b >= 0) seat[b] = cell;
        }
      }
    }
  }
  return seat;
}

function anchorsFor(chart: StarChart, clusters: Group[]): { x: number; y: number }[] {
  const rnd = mulberry32(5);
  const groups = clusters.length;
  const cols = Math.ceil(Math.sqrt(groups));
  const rows = Math.ceil(groups / cols);
  const seat = seatClusters(chart, clusters, cols, cols * rows);
  const cell = Math.max(250, Math.sqrt(Math.max(...clusters.map((a) => a.stars.length))) * 92);
  return seat.map((i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const shift = row % 2 ? 0.22 : -0.22;
    return {
      x: (col + 0.5 + shift) * cell + (rnd() - 0.5) * 40,
      y: (row + 0.5) * cell * 0.85 + (rnd() - 0.5) * 30,
    };
  });
}

/** A star's label lines and the space they take. */
function labelSize(star: Star): { lines: string[]; size: number; w: number; h: number } {
  const size = star.roles.includes('central') ? CENTRAL_SIZE : LABEL_SIZE;
  const lines = wrapText(star.label, size, star.labelLang === 'zh' ? 118 : 136);
  const w = Math.max(...lines.map((l) => textWidth(l, size))) + 4;
  return { lines, size, w, h: lines.length * LINE_HEIGHT };
}

function placeLabels(nodes: Node[], clusters: SkyCluster[]): Map<number, SkyLabel> {
  const starBoxes = nodes.map((n) => ({
    x1: n.x - n.r - 2,
    y1: n.y - n.r - 2,
    x2: n.x + n.r + 2,
    y2: n.y + n.r + 2,
  }));
  const placed: Box[] = [];
  const areaBoxes = clusters.flatMap((c) => c.label?.box ?? []);
  const order = [...nodes].sort(
    (a, b) =>
      Number(b.star.roles.includes('central')) - Number(a.star.roles.includes('central')) ||
      a.star.number - b.star.number,
  );
  const labels = new Map<number, SkyLabel>();
  for (const n of order) {
    const { lines, size, w, h } = labelSize(n.star);
    const best = bestLabelSpot(n, w, h, (box) => {
      let cost = 0;
      starBoxes.forEach((o, i) => {
        if (nodes[i] !== n) cost += overlapArea(box, o) * 40;
      });
      for (const o of placed) {
        const area = overlapArea(box, o);
        if (area > 0) cost += 1000 + area * 1000;
      }
      for (const o of areaBoxes) cost += overlapArea(box, o) * 6;
      return cost;
    });
    placed.push(best.box);
    labels.set(n.star.number, { lines, size, lineHeight: LINE_HEIGHT, ...best });
  }
  return labels;
}

function bestLabelSpot(
  n: Node,
  w: number,
  h: number,
  cost: (box: Box) => number,
): Omit<SkyLabel, 'lines' | 'size' | 'lineHeight'> {
  let best: Omit<SkyLabel, 'lines' | 'size' | 'lineHeight'> | undefined;
  let bestCost = Infinity;
  for (let ring = 0; ring < 14; ring++) {
    const r = n.r + 5 + ring * 12;
    const candidates: { x: number; y: number; anchor: SkyLabel['anchor'] }[] = [
      { x: n.x + r, y: n.y - h / 2, anchor: 'start' },
      { x: n.x - r, y: n.y - h / 2, anchor: 'end' },
      { x: n.x, y: n.y + r, anchor: 'middle' },
      { x: n.x, y: n.y - r - h, anchor: 'middle' },
      { x: n.x + r - 3, y: n.y - r - h + 6, anchor: 'start' },
      { x: n.x + r - 3, y: n.y + r - 6, anchor: 'start' },
      { x: n.x - r + 3, y: n.y - r - h + 6, anchor: 'end' },
      { x: n.x - r + 3, y: n.y + r - 6, anchor: 'end' },
    ];
    candidates.forEach((c, i) => {
      const x1 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
      const box = { x1, y1: c.y, x2: x1 + w, y2: c.y + h };
      const total = cost(box) + i * 2 + ring * 60;
      if (total < bestCost) {
        bestCost = total;
        best = { ...c, box };
      }
    });
    if (bestCost < 1000) break;
  }
  return best!;
}

function moved(box: Box, dx: number, dy: number): Box {
  return { x1: box.x1 + dx, y1: box.y1 + dy, x2: box.x2 + dx, y2: box.y2 + dy };
}

/** Prim's shortest tree over a constellation's stars: its constellation lines. */
function shortestTree(points: SkyStar[]): [number, number][] {
  if (points.length < 2) return [];
  const inTree = [points[0]];
  const rest = points.slice(1);
  const segments: [number, number][] = [];
  while (rest.length) {
    let best: { a: SkyStar; b: SkyStar; d: number } | undefined;
    for (const a of inTree) {
      for (const b of rest) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    segments.push([best!.a.number, best!.b.number]);
    inTree.push(best!.b);
    rest.splice(rest.indexOf(best!.b), 1);
  }
  return segments;
}

const NAME_SIZE = 16;
const FACTS_SIZE = 12;
const NAME_HEIGHT = 36;

/** Names each constellation clear of everything placed; clustered by one, above it first. */
function placeConstellations(
  chart: StarChart,
  stars: SkyStar[],
  clusters: SkyCluster[],
  by: Clustering,
): SkyConstellation[] {
  const at = new Map(stars.map((s) => [s.number, s]));
  const taken: Box[] = [
    ...stars.map((s) => s.label.box),
    ...stars.map((s) => ({ x1: s.x - s.r, y1: s.y - s.r, x2: s.x + s.r, y2: s.y + s.r })),
    ...clusters.flatMap((c) => c.label?.box ?? []),
  ];
  const t = useTranslations(chart.locale);
  const out: SkyConstellation[] = [];
  const groupOf = new Map(chart.constellations.map((g) => [g.number, g] as const));
  // Clustered by area, only the open constellations are named.
  const named = chart.clusters.constellations.flatMap((cluster) =>
    cluster.kind === 'constellation' || (cluster.kind === 'finished' && by === 'constellations')
      ? [groupOf.get(cluster.constellation!)!]
      : [],
  );
  for (const c of named) {
    const points = starsOf(c).flatMap((n) => at.get(n) ?? []);
    if (!points.length) continue;
    const boxes = points.flatMap((p) => [
      p.label.box,
      { x1: p.x - p.r, y1: p.y - p.r, x2: p.x + p.r, y2: p.y + p.r },
    ]);
    const x1 = Math.min(...boxes.map((b) => b.x1));
    const x2 = Math.max(...boxes.map((b) => b.x2));
    const y1 = Math.min(...boxes.map((b) => b.y1));
    const y2 = Math.max(...boxes.map((b) => b.y2));
    const w = Math.max(
      textWidth(c.name, NAME_SIZE) * 0.95,
      c.finished ? 0 : textWidth(constellationFacts(c, t), FACTS_SIZE),
      160,
    );
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    let best: SkyConstellation['label'] | undefined;
    let bestCost = Infinity;
    for (let ring = 0; ring < 10; ring++) {
      const gap = 8 + ring * 22;
      const below = { x: cx, y: y2 + gap };
      const above = { x: cx, y: y1 - gap - NAME_HEIGHT };
      const spots = [
        ...(by === 'constellations' ? [above, below] : [below, above]),
        { x: x2 + gap + w / 2, y: cy - NAME_HEIGHT / 2 },
        { x: x1 - gap - w / 2, y: cy - NAME_HEIGHT / 2 },
      ];
      spots.forEach((spot, i) => {
        const box = {
          x1: spot.x - w / 2,
          y1: spot.y,
          x2: spot.x + w / 2,
          y2: spot.y + NAME_HEIGHT,
        };
        let cost = i * 5 + ring * 80;
        for (const o of taken) cost += overlapArea(box, o) * 1000;
        if (cost < bestCost) {
          bestCost = cost;
          best = { x: spot.x, y: spot.y, box };
        }
      });
      if (bestCost < 1000) break;
    }
    taken.push(best!.box);
    const placed: SkyConstellation = {
      number: c.number,
      segments: shortestTree(points),
      label: best!,
    };
    if (c.finished) placed.finished = true;
    out.push(placed);
  }
  return out;
}

/** The stars of each cluster, in the order of the chart's cluster list. */
function groupsFor(chart: StarChart, by: Clustering): Group[] {
  return chart.clusters[by].map((c) => {
    const group: Group = { stars: c.questions };
    if (c.area) group.area = c.area;
    if (c.constellation !== undefined) group.constellation = c.constellation;
    return group;
  });
}

/** One clustering of the sky, before it is moved onto the shared canvas. */
interface Placed {
  by: Clustering;
  stars: SkyStar[];
  clusters: SkyCluster[];
  constellations: SkyConstellation[];
}

function place(chart: StarChart, by: Clustering): Placed {
  const groups = groupsFor(chart, by);
  const anchors = anchorsFor(chart, groups);
  const byNumber = new Map(chart.stars.map((s) => [s.number, s]));
  const rnd = mulberry32(7);
  const nodes: Node[] = groups.flatMap((group, g) =>
    group.stars.map((number, k) => {
      const star = byNumber.get(number)!;
      const angle = k * 2.39996 + rnd() * 0.4;
      const radius = 30 * Math.sqrt(k + 0.6);
      const r = starRadius(star);
      const { w, h } = labelSize(star);
      return {
        star,
        group: g,
        x: anchors[g].x + Math.cos(angle) * radius,
        y: anchors[g].y + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        r,
        hx: Math.max(40, r + 30, w * 0.55),
        hy: Math.max(26, r + 18, h * 0.6 + 6),
      };
    }),
  );
  settle(chart, nodes, anchors);

  const clusters: SkyCluster[] = groups.map((group, g) => {
    const members = nodes.filter((n) => n.group === g);
    const xs = members.map((n) => n.x);
    const ys = members.map((n) => n.y);
    const x = xs.reduce((s, v) => s + v, 0) / xs.length;
    const y = ys.reduce((s, v) => s + v, 0) / ys.length;
    const rx = Math.max(...xs) - Math.min(...xs);
    const ry = Math.max(...ys) - Math.min(...ys);
    const cluster: SkyCluster = { x, y, rx: rx / 2 + 70, ry: ry / 2 + 60 };
    if (group.area) cluster.area = group.area;
    if (group.constellation !== undefined) cluster.constellation = group.constellation;
    else cluster.label = labelSpot();
    return cluster;

    function labelSpot() {
      const name = group.area ?? '';
      const w = Math.max(textWidth(name, AREA_SIZE) * 1.1, by === 'areas' ? 40 : 150);
      const top = Math.min(...ys) - 38;
      return {
        x,
        y: top,
        box: { x1: x - w / 2, y1: top - AREA_SIZE, x2: x + w / 2, y2: top + 4 },
      };
    }
  });

  const labels = placeLabels(nodes, clusters);
  const stars: SkyStar[] = nodes
    .map((n) => ({
      number: n.star.number,
      x: n.x,
      y: n.y,
      r: n.r,
      label: labels.get(n.star.number)!,
    }))
    .sort((a, b) => a.number - b.number);
  return { by, stars, clusters, constellations: placeConstellations(chart, stars, clusters, by) };
}

function boxesOf(p: Placed): Box[] {
  return [
    ...p.constellations.map((c) => c.label.box),
    ...p.stars.map((s) => s.label.box),
    ...p.stars.map((s) => ({ x1: s.x - s.r, y1: s.y - s.r, x2: s.x + s.r, y2: s.y + s.r })),
    ...p.clusters.flatMap((c) => c.label?.box ?? []),
  ];
}

function extent(p: Placed): Box {
  const boxes = boxesOf(p);
  return {
    x1: Math.min(...boxes.map((b) => b.x1)),
    y1: Math.min(...boxes.map((b) => b.y1)),
    x2: Math.max(...boxes.map((b) => b.x2)),
    y2: Math.max(...boxes.map((b) => b.y2)),
  };
}

/** Moves a clustering onto the shared canvas, centred on it, and draws its threads. */
function finish(chart: StarChart, p: Placed, width: number, height: number): SkyLayout {
  const e = extent(p);
  const dx = (width - (e.x2 - e.x1)) / 2 - e.x1;
  const dy = (height - (e.y2 - e.y1)) / 2 - e.y1;
  const round = (v: number) => Math.round(v * 10) / 10;
  const spot = <T extends { x: number; y: number; box: Box }>(l: T): T => ({
    ...l,
    x: round(l.x + dx),
    y: round(l.y + dy),
    box: moved(l.box, dx, dy),
  });
  const stars = p.stars.map((s) => ({
    ...s,
    x: round(s.x + dx),
    y: round(s.y + dy),
    label: spot(s.label),
  }));
  const clusters = p.clusters.map((c) => {
    const out: SkyCluster = { ...c, x: round(c.x + dx), y: round(c.y + dy) };
    if (c.label) out.label = spot(c.label);
    return out;
  });
  const constellations = p.constellations.map((c) => ({ ...c, label: spot(c.label) }));
  const placed = new Map(stars.map((s) => [s.number, s]));
  const threads = chart.threads.map((t) => ({
    ...t,
    d: curve(placed.get(t.from)!, placed.get(t.to)!, threadBend(t)),
  }));
  return { by: p.by, width, height, stars, clusters, threads, constellations };
}

/**
 * The night sky clustered by area and, when there are constellations, by constellation, on
 * one canvas so that the stars can fly from one to the other.
 */
export function layoutSkies(chart: StarChart): { areas: SkyLayout; constellations?: SkyLayout } {
  const byArea = place(chart, 'areas');
  const byConstellation = openConstellations(chart).some((c) => starsOf(c).length)
    ? place(chart, 'constellations')
    : undefined;
  const extents = [byArea, byConstellation].flatMap((p) => (p ? [extent(p)] : []));
  const width = Math.ceil(Math.max(...extents.map((e) => e.x2 - e.x1)) + 2 * MARGIN);
  const height = Math.ceil(Math.max(...extents.map((e) => e.y2 - e.y1)) + 2 * MARGIN);
  const out: { areas: SkyLayout; constellations?: SkyLayout } = {
    areas: finish(chart, byArea, width, height),
  };
  if (byConstellation) out.constellations = finish(chart, byConstellation, width, height);
  return out;
}

/** The night sky clustered by area. */
export function layoutSky(chart: StarChart): SkyLayout {
  return layoutSkies(chart).areas;
}
