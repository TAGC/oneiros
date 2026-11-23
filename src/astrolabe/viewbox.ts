/**
 * Pan and zoom arithmetic for the night sky, in plain numbers. The client keeps the view box
 * itself rather than asking the SVG for its screen matrix, which would force a layout on
 * every pointer or wheel event.
 */

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the SVG sits on screen: a client rectangle. */
export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** `meet` fits the whole box in the frame; `slice` fills the frame and crops the box. */
export type Fit = 'meet' | 'slice';

/** Screen pixels per sky unit, for a centred (`xMidYMid`) box. */
export function pixelsPerUnit(box: ViewBox, frame: Frame, fit: Fit): number {
  const sx = frame.width / box.w;
  const sy = frame.height / box.h;
  return fit === 'meet' ? Math.min(sx, sy) : Math.max(sx, sy);
}

/** The sky point under a client point. */
export function toSky(
  box: ViewBox,
  frame: Frame,
  fit: Fit,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const s = pixelsPerUnit(box, frame, fit);
  const left = frame.left + (frame.width - box.w * s) / 2;
  const top = frame.top + (frame.height - box.h * s) / 2;
  return { x: box.x + (clientX - left) / s, y: box.y + (clientY - top) / s };
}

/** The box moved by a drag of (dx, dy) screen pixels. */
export function panBox(box: ViewBox, frame: Frame, fit: Fit, dx: number, dy: number): ViewBox {
  const s = pixelsPerUnit(box, frame, fit);
  return { ...box, x: box.x - dx / s, y: box.y - dy / s };
}

/**
 * The box zoomed by `factor` (above 1 zooms in) about a client point, which stays put.
 * The width stays between `minW` and `maxW`.
 */
export function zoomBox(
  box: ViewBox,
  frame: Frame,
  fit: Fit,
  clientX: number,
  clientY: number,
  factor: number,
  minW: number,
  maxW: number,
): ViewBox {
  const w = Math.min(maxW, Math.max(minW, box.w / factor));
  const f = box.w / w;
  const p = toSky(box, frame, fit, clientX, clientY);
  return {
    x: p.x - (p.x - box.x) / f,
    y: p.y - (p.y - box.y) / f,
    w,
    h: (box.h * w) / box.w,
  };
}

/**
 * The CSS transform (origin at the frame's top left) that makes an SVG drawn with `drawn`
 * look as it would with `box`. Both boxes must share an aspect ratio, as panning and
 * zooming keep it. Moving the drawn picture is cheap; redrawing a big SVG every frame is not.
 */
export function boxTransform(
  drawn: ViewBox,
  box: ViewBox,
  frame: Frame,
  fit: Fit,
): { k: number; tx: number; ty: number } {
  const k = drawn.w / box.w;
  const s = pixelsPerUnit(box, frame, fit);
  // The box's offset in the frame depends only on its aspect ratio, so both boxes share it.
  const offX = (frame.width - box.w * s) / 2;
  const offY = (frame.height - box.h * s) / 2;
  return {
    k,
    tx: offX * (1 - k) + (drawn.x - box.x) * s,
    ty: offY * (1 - k) + (drawn.y - box.y) * s,
  };
}
