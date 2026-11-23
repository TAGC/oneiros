/**
 * A night sky thread's path, shared by the build and the client: the client redraws threads
 * with it while stars fly between the two clusterings.
 */
import type { Thread } from '../lib/questions';

export interface Point {
  x: number;
  y: number;
  /** How far the glyph reaches from its centre. */
  r: number;
}

/** How far a thread bows: undermining threads bow more; others alternate sides. */
export function threadBend(t: Thread): number {
  if (t.kind === 'undermines') return 0.22;
  return (t.from + t.to) % 2 ? 0.12 : -0.12;
}

/** A quadratic curve from the edge of one star to the edge of the other. */
export function curve(a: Point, b: Point, bend: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = (a.x + b.x) / 2 - dy * bend;
  const cy = (a.y + b.y) / 2 + dx * bend;
  const toward = (p: Point, r: number): [number, number] => {
    const l = Math.hypot(cx - p.x, cy - p.y) || 1;
    return [p.x + ((cx - p.x) / l) * r, p.y + ((cy - p.y) / l) * r];
  };
  const [sx, sy] = toward(a, a.r + 3);
  const [ex, ey] = toward(b, b.r + 6);
  const f = (v: number) => v.toFixed(1);
  return `M${f(sx)},${f(sy)}Q${f(cx)},${f(cy)} ${f(ex)},${f(ey)}`;
}
