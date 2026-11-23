import { describe, expect, test } from 'bun:test';
import { flight, STAGGER } from './motion';

describe('a star’s flight between clusterings', () => {
  test('starts at its old place and ends at its new one', () => {
    for (const n of [1, 2, 17, 104]) {
      expect(flight(0, n)).toBe(0);
      expect(flight(1, n)).toBe(1);
    }
  });

  test('only ever moves forward', () => {
    for (const n of [3, 58]) {
      let last = 0;
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const p = flight(t, n);
        expect(p).toBeGreaterThanOrEqual(last);
        last = p;
      }
    }
  });

  test('sets off at staggered times, all within the first part of the flight', () => {
    const starts = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
      let t = 0;
      while (flight(t, n) === 0) t += 0.005;
      return t;
    });
    expect(new Set(starts.map((t) => t.toFixed(3))).size).toBeGreaterThan(3);
    for (const t of starts) expect(t).toBeLessThanOrEqual(STAGGER + 0.01);
  });
});
