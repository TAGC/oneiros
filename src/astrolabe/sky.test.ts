import { describe, expect, test } from 'bun:test';
import type { Area, Question } from '../lib/questions';
import { questionGraph } from '../lib/questions';
import { chartQuestions } from './chart';
import { type Box, layoutSky } from './sky';

function question(
  number: number,
  area: Area | undefined,
  fixture: Partial<Question> = {},
): Question {
  return {
    number,
    url: `https://github.com/TAGC/oneiros/issues/${number}`,
    kind: 'open',
    ...(area ? { area } : {}),
    state: 'open',
    status: 'open',
    title: {
      en: `Does question ${number} have a fairly long title to wrap?`,
      zh: `第 ${number} 个问题的标题是否足够长以至于需要换行？`,
    },
    text: { en: 'English.' },
    properties: {},
    blockedBy: [],
    underminedBy: [],
    ...fixture,
  };
}

const AREAS_USED: (Area | undefined)[] = ['Beliefs', 'Memory', 'World', 'Magic', undefined];

function questions(): Question[] {
  const list: Question[] = [];
  let n = 1;
  for (const area of AREAS_USED) {
    for (let i = 0; i < 5; i++) list.push(question(n++, area));
  }
  list[1].blockedBy = [1];
  list[2].blockedBy = [1];
  list[7].blockedBy = [2];
  list[12].blockedBy = [8, 3];
  list[20] = { ...list[20], state: 'closed', status: 'decided' };
  return list;
}

function sky(locale: 'en' | 'zh' = 'en') {
  const qs = questions();
  return layoutSky(chartQuestions(qs, questionGraph(qs), locale));
}

const overlap = (a: Box, b: Box) =>
  Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1) && Math.min(a.y2, b.y2) > Math.max(a.y1, b.y1);

describe('the sky layout', () => {
  test('is the same every time for the same chart', () => {
    expect(sky()).toEqual(sky());
  });

  test('keeps stars apart', () => {
    const { stars } = sky();
    for (const a of stars) {
      for (const b of stars) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  test('clusters each star nearer its own area than any other area', () => {
    const layout = sky();
    const area = new Map(questions().map((q) => [q.number, q.area]));
    for (const s of layout.stars) {
      const distances = layout.areas.map((a) => ({
        area: a.area,
        d: Math.hypot(s.x - a.x, s.y - a.y),
      }));
      const nearest = distances.sort((a, b) => a.d - b.d)[0];
      expect(nearest.area).toBe(area.get(s.number));
    }
  });

  test('fits every star, label and area name on the canvas', () => {
    for (const locale of ['en', 'zh'] as const) {
      const layout = sky(locale);
      const boxes = [
        ...layout.stars.map((s) => s.label.box),
        ...layout.areas.map((a) => a.label.box),
      ];
      for (const s of layout.stars) {
        boxes.push({ x1: s.x - s.r, y1: s.y - s.r, x2: s.x + s.r, y2: s.y + s.r });
      }
      for (const b of boxes) {
        expect(b.x1).toBeGreaterThanOrEqual(0);
        expect(b.y1).toBeGreaterThanOrEqual(0);
        expect(b.x2).toBeLessThanOrEqual(layout.width);
        expect(b.y2).toBeLessThanOrEqual(layout.height);
      }
    }
  });

  test('wraps titles and keeps labels from covering each other', () => {
    for (const locale of ['en', 'zh'] as const) {
      const labels = sky(locale).stars.map((s) => s.label);
      expect(labels.every((l) => l.lines.length >= 2)).toBe(true);
      for (const a of labels) {
        for (const b of labels) if (a !== b) expect(overlap(a.box, b.box)).toBe(false);
      }
    }
  });

  test('sets areas with many links between them side by side', () => {
    const qs = questions();
    for (const q of qs) q.blockedBy = [];
    qs[20].blockedBy = [1];
    qs[21].blockedBy = [2];
    qs[22].blockedBy = [3];
    qs[23].blockedBy = [4];
    const layout = layoutSky(chartQuestions(qs, questionGraph(qs), 'en'));
    const centre = (area: Area | undefined) => layout.areas.find((a) => a.area === area)!;
    const beliefs = centre('Beliefs');
    const others = layout.areas
      .filter((a) => a !== beliefs)
      .sort(
        (a, b) =>
          Math.hypot(a.x - beliefs.x, a.y - beliefs.y) -
          Math.hypot(b.x - beliefs.x, b.y - beliefs.y),
      );
    expect(others[0].area).toBeUndefined();
  });

  test('joins each constellation with lines and names it clear of the star labels', () => {
    const qs = questions();
    const members = [qs[0], qs[6], qs[11], qs[12]];
    const fake = {
      all: () => [],
      open: () => [
        {
          number: 3,
          url: 'https://github.com/TAGC/oneiros/milestone/3',
          state: 'open' as const,
          name: { en: 'A fairly long constellation name' },
          reasoning: {},
          questions: members,
        },
      ],
      of: () => undefined,
      ungrouped: () => [],
    };
    const layout = layoutSky(chartQuestions(qs, questionGraph(qs), 'en', fake));
    const [c] = layout.constellations;
    expect(c.number).toBe(3);
    expect(c.segments).toHaveLength(3);
    const joined = new Set(c.segments.flat());
    expect([...joined].sort((a, b) => a - b)).toEqual([1, 7, 12, 13]);
    for (const s of layout.stars) expect(overlap(c.label.box, s.label.box)).toBe(false);
    expect(c.label.box.x1).toBeGreaterThanOrEqual(0);
    expect(c.label.box.y1).toBeGreaterThanOrEqual(0);
    expect(c.label.box.x2).toBeLessThanOrEqual(layout.width);
    expect(c.label.box.y2).toBeLessThanOrEqual(layout.height);
  });

  test('draws a thread for each link, as a path between the two stars', () => {
    const layout = sky();
    expect(layout.threads.map((t) => [t.from, t.to])).toEqual([
      [1, 2],
      [1, 3],
      [2, 8],
      [3, 13],
      [8, 13],
    ]);
    const one = layout.stars.find((s) => s.number === 1)!;
    const start = /^M([\d.-]+),([\d.-]+)/.exec(layout.threads[0].d)!;
    expect(Math.hypot(Number(start[1]) - one.x, Number(start[2]) - one.y)).toBeLessThan(one.r + 12);
  });
});
