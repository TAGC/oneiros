/**
 * Bakes the night sky's nebulae into one bitmap. They are a few hundred overlapping gradient
 * shapes: cheap to draw once, but too slow to redraw on every frame of a pan or zoom, which
 * left the browser showing the sky without them. A bitmap scales for free, and soft glows
 * lose nothing to it. If the browser refuses (a tainted canvas, say), the shapes stay.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Bitmap pixels per sky unit, capped so the longest side stays a modest texture. */
const MAX_SCALE = 1.5;
const MAX_SIDE = 2560;

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The shapes' bounds from their attributes, so a hidden sky can be baked too. */
function boundsOf(shapes: Element[]): Bounds | undefined {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of shapes) {
    const n = (a: string) => Number(s.getAttribute(a) ?? 0);
    const rx = s.tagName === 'ellipse' ? n('rx') : n('r');
    const ry = s.tagName === 'ellipse' ? n('ry') : n('r');
    x0 = Math.min(x0, n('cx') - rx);
    y0 = Math.min(y0, n('cy') - ry);
    x1 = Math.max(x1, n('cx') + rx);
    y1 = Math.max(y1, n('cy') + ry);
  }
  if (!(x1 > x0 && y1 > y0)) return undefined;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export async function bakeNebulae(back: SVGSVGElement): Promise<void> {
  const group = back.querySelector<SVGGElement>('.al-nebulae');
  const shapes = group ? [...group.querySelectorAll('circle, ellipse')] : [];
  const b = boundsOf(shapes);
  if (!group || !b) return;
  const scale = Math.min(MAX_SCALE, MAX_SIDE / Math.max(b.w, b.h));
  const w = Math.round(b.w * scale);
  const h = Math.round(b.h * scale);

  // A standalone copy: the gradients take their colours from the page's CSS, so write the
  // computed colours onto the stops.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  const defs = document.createElementNS(SVG_NS, 'defs');
  for (const gradient of back.querySelectorAll('radialGradient[id^="al-neb-"]')) {
    const copy = gradient.cloneNode(true) as Element;
    copy.removeAttribute('style');
    const stops = gradient.querySelectorAll('stop');
    copy.querySelectorAll('stop').forEach((stop, i) => {
      const style = getComputedStyle(stops[i]!);
      stop.removeAttribute('class');
      stop.setAttribute('stop-color', style.stopColor);
      stop.setAttribute('stop-opacity', style.stopOpacity);
    });
    defs.append(copy);
  }
  svg.append(defs, ...shapes.map((s) => s.cloneNode(true)));

  const source = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }),
  );
  try {
    const picture = new Image();
    picture.src = source;
    await picture.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(picture, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done));
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const loaded = new Image();
    loaded.src = href;
    await loaded.decode();
    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('href', href);
    image.setAttribute('x', String(b.x));
    image.setAttribute('y', String(b.y));
    image.setAttribute('width', String(b.w));
    image.setAttribute('height', String(b.h));
    image.setAttribute('preserveAspectRatio', 'none');
    group.replaceChildren(image);
  } catch {
    // Keep the shapes.
  } finally {
    URL.revokeObjectURL(source);
  }
}
