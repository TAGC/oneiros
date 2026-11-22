/**
 * Flies the night sky's stars between their places clustered by area and by constellation,
 * with their labels, threads and constellation lines following. Positions come from the
 * build (`.al-sky-motion`); this only moves what is already drawn.
 */
import type { Thread } from './chart';
import { curve, threadBend } from './curve';
import { flight, FLIGHT_MS, type SkyMotionData, type SkySpot } from './motion';

type By = 'areas' | 'constellations';

interface Placed {
  glyph: SVGGElement;
  label: SVGTextElement;
  lines: SVGTSpanElement[];
}

export function skyMotion(sky: SVGSVGElement, data: SkyMotionData) {
  const stars = new Map<string, Placed>();
  for (const el of sky.querySelectorAll<SVGAElement>('.al-star')) {
    const glyph = el.querySelector<SVGGElement>(':scope > g');
    const label = el.querySelector<SVGTextElement>('.al-label');
    if (!glyph || !label) continue;
    stars.set(el.dataset.n!, { glyph, label, lines: [...label.querySelectorAll('tspan')] });
  }
  const threads = [...sky.querySelectorAll<SVGPathElement>('.al-threads .al-thread')].map((el) => ({
    el,
    thread: {
      from: Number(el.dataset.from),
      to: Number(el.dataset.to),
      kind: el.dataset.kind as Thread['kind'],
    },
  }));
  const segments = [...sky.querySelectorAll<SVGLineElement>('.al-cline')];
  const rings = [...sky.querySelectorAll<SVGCircleElement>('.al-cring')];
  const view = sky.closest('.al-view-sky');

  const at = new Map<string, { x: number; y: number; r: number }>();
  for (const [n, s] of Object.entries(data.areas)) at.set(n, { x: s[0], y: s[1], r: s[2] });
  /** How far each label is drawn from the place its attributes give, while it flies. */
  const offset = new Map<string, { x: number; y: number }>();
  let frame = 0;

  const f = (v: number) => v.toFixed(1);
  const setLabel = (n: string, spot: SkySpot) => {
    const star = stars.get(n)!;
    star.label.setAttribute('text-anchor', spot[5]);
    star.lines.forEach((line, i) => {
      line.setAttribute('x', String(spot[3]));
      line.setAttribute('y', f(spot[4] + i * data.lineHeight));
    });
  };
  const draw = () => {
    for (const [n, star] of stars) {
      const p = at.get(n)!;
      star.glyph.setAttribute('transform', `translate(${f(p.x)} ${f(p.y)})`);
      const o = offset.get(n);
      if (o) star.label.setAttribute('transform', `translate(${f(o.x)} ${f(o.y)})`);
      else star.label.removeAttribute('transform');
    }
    for (const { el, thread } of threads) {
      const a = at.get(String(thread.from));
      const b = at.get(String(thread.to));
      if (a && b) el.setAttribute('d', curve(a, b, threadBend(thread)));
    }
    for (const line of segments) {
      const a = at.get(line.dataset.a!)!;
      const b = at.get(line.dataset.b!)!;
      line.setAttribute('x1', f(a.x));
      line.setAttribute('y1', f(a.y));
      line.setAttribute('x2', f(b.x));
      line.setAttribute('y2', f(b.y));
    }
    for (const ring of rings) {
      const p = at.get(ring.dataset.n!)!;
      ring.setAttribute('cx', f(p.x));
      ring.setAttribute('cy', f(p.y));
    }
  };

  /** Moves the sky to a clustering: in flight, or at once. */
  const show = (by: By, animate: boolean) => {
    cancelAnimationFrame(frame);
    const target = data[by];
    if (!animate) {
      view?.classList.remove('al-flying');
      for (const [n, s] of Object.entries(target)) {
        at.set(n, { x: s[0], y: s[1], r: s[2] });
        setLabel(n, s);
      }
      offset.clear();
      draw();
      return;
    }
    // Each label keeps its place on screen as it takes its new attributes, then flies home.
    const before = new Map([...stars].map(([n, s]) => [n, s.label.getBBox()]));
    for (const [n, s] of Object.entries(target)) setLabel(n, s);
    const start = new Map<string, { x: number; y: number }>();
    for (const [n, s] of stars) {
      const was = before.get(n)!;
      const now = s.label.getBBox();
      const o = offset.get(n) ?? { x: 0, y: 0 };
      start.set(n, { x: was.x + o.x - now.x, y: was.y + o.y - now.y });
    }
    const from = new Map([...at].map(([n, p]) => [n, { ...p }]));
    const began = performance.now();
    const tick = (time: number) => {
      const t = Math.min(1, Math.max(0, (time - began) / FLIGHT_MS));
      for (const [n, s] of Object.entries(target)) {
        const p = flight(t, Number(n));
        const a = from.get(n)!;
        at.set(n, { x: a.x + (s[0] - a.x) * p, y: a.y + (s[1] - a.y) * p, r: s[2] });
        const o = start.get(n)!;
        if (p < 1) offset.set(n, { x: o.x * (1 - p), y: o.y * (1 - p) });
        else offset.delete(n);
      }
      draw();
      if (t < 1) frame = requestAnimationFrame(tick);
      else view?.classList.remove('al-flying');
    };
    // The twinkle rests while the stars fly, as it does while the sky is dragged or zoomed.
    view?.classList.add('al-flying');
    frame = requestAnimationFrame(tick);
  };

  return { show };
}
