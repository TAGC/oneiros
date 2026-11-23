import { describe, expect, test } from 'bun:test';
import { panBox, pixelsPerUnit, toSky, zoomBox } from './viewbox';

const box = { x: 0, y: 0, w: 2000, h: 1000 };
/** A frame half the box's width and as tall as wide: meet leaves bands above and below. */
const frame = { left: 100, top: 50, width: 1000, height: 1000 };

describe('pixelsPerUnit', () => {
  test('meet fits the whole box', () => {
    expect(pixelsPerUnit(box, frame, 'meet')).toBe(0.5);
  });

  test('slice fills the frame', () => {
    expect(pixelsPerUnit(box, frame, 'slice')).toBe(1);
  });
});

describe('toSky', () => {
  test('meet centres the box with bands above and below', () => {
    // The box is 500 px tall in a 1000 px frame: it starts 250 px down.
    expect(toSky(box, frame, 'meet', 100, 300)).toEqual({ x: 0, y: 0 });
    expect(toSky(box, frame, 'meet', 1100, 800)).toEqual({ x: 2000, y: 1000 });
  });

  test('slice centres the box and crops its sides', () => {
    // The box is 2000 px wide in a 1000 px frame: 500 px hang off each side.
    expect(toSky(box, frame, 'slice', 100, 50)).toEqual({ x: 500, y: 0 });
    expect(toSky(box, frame, 'slice', 600, 550)).toEqual({ x: 1000, y: 500 });
  });

  test('follows a moved box', () => {
    const moved = { x: -300, y: 200, w: 1000, h: 500 };
    expect(toSky(moved, frame, 'meet', 600, 550)).toEqual({ x: 200, y: 450 });
  });
});

describe('panBox', () => {
  test('moves the box against the drag, in sky units', () => {
    expect(panBox(box, frame, 'meet', 10, -20)).toEqual({ x: -20, y: 40, w: 2000, h: 1000 });
    expect(panBox(box, frame, 'slice', 10, -20)).toEqual({ x: -10, y: 20, w: 2000, h: 1000 });
  });
});

describe('zoomBox', () => {
  const zoom = (fit: 'meet' | 'slice', cx: number, cy: number, factor: number) =>
    zoomBox(box, frame, fit, cx, cy, factor, 200, 3200);

  test('keeps the point under the pointer in place', () => {
    for (const fit of ['meet', 'slice'] as const) {
      const before = toSky(box, frame, fit, 420, 610);
      const after = zoom(fit, 420, 610, 1.4);
      const p = toSky(after, frame, fit, 420, 610);
      expect(p.x).toBeCloseTo(before.x, 9);
      expect(p.y).toBeCloseTo(before.y, 9);
    }
  });

  test('scales width and height together', () => {
    const z = zoom('meet', 600, 550, 2);
    expect(z.w).toBe(1000);
    expect(z.h).toBe(500);
  });

  test('stays within the width limits', () => {
    expect(zoom('meet', 600, 550, 100).w).toBe(200);
    expect(zoom('meet', 600, 550, 0.01).w).toBe(3200);
  });
});
