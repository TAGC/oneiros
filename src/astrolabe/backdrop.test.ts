import { describe, expect, test } from 'bun:test';
import { circlePath, OPACITY_STEP, scatterSpecks, speckPaths } from './backdrop';

const circles = (d: string) => d.match(/M/g)?.length ?? 0;

describe('scatterSpecks', () => {
  test('is seeded, so every build draws the same sky', () => {
    expect(scatterSpecks(800, 600, 100)).toEqual(scatterSpecks(800, 600, 100));
  });

  test('covers the sky and its margin at one speck per 4500 square units', () => {
    const specks = scatterSpecks(800, 600, 100);
    expect(specks).toHaveLength(Math.round((1000 * 800) / 4500));
    for (const s of specks) {
      expect(s.x).toBeGreaterThanOrEqual(-100);
      expect(s.x).toBeLessThanOrEqual(900);
      expect(s.y).toBeGreaterThanOrEqual(-100);
      expect(s.y).toBeLessThanOrEqual(700);
      expect(s.o).toBeGreaterThanOrEqual(0.25);
      expect(s.o).toBeLessThanOrEqual(1);
    }
  });

  test('one speck in nine twinkles, on one of 35 rhythms', () => {
    const specks = scatterSpecks(800, 600, 100);
    expect(specks.filter((s) => s.tw)).toHaveLength(Math.ceil(specks.length / 9));
    expect(specks[0].tw).toEqual({ period: 3, delay: 0 });
    expect(specks[9].tw).toEqual({ period: 7, delay: 2 });
  });
});

describe('circlePath', () => {
  test('draws a circle as two half arcs from its left edge', () => {
    expect(circlePath({ x: 10, y: 20, r: 1.5 })).toBe(
      'M8.5 20a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',
    );
  });
});

describe('speckPaths', () => {
  const specks = scatterSpecks(2334, 1394, 820);
  const paths = speckPaths(specks);

  test('draws every speck exactly once', () => {
    expect(paths.reduce((n, p) => n + circles(p.d), 0)).toBe(specks.length);
  });

  test('uses a few dozen paths for thousands of specks', () => {
    expect(specks.length).toBeGreaterThan(2000);
    expect(paths.length).toBeLessThanOrEqual(1 + 0.75 / OPACITY_STEP + 35);
  });

  test('keeps still specks within half an opacity step of their own opacity', () => {
    const still = paths.filter((p) => !p.tw);
    for (const s of specks.filter((speck) => !speck.tw)) {
      const path = still.find((p) => p.d.includes(circlePath(s)))!;
      expect(Math.abs(path.opacity - s.o)).toBeLessThanOrEqual(OPACITY_STEP / 2 + 1e-9);
    }
  });

  test('groups twinkling specks by rhythm', () => {
    const twinkling = paths.filter((p) => p.tw);
    expect(twinkling).toHaveLength(35);
    for (const s of specks.filter((speck) => speck.tw)) {
      const path = twinkling.find((p) => p.d.includes(circlePath(s)))!;
      expect(path.tw).toEqual(s.tw!);
    }
  });
});
