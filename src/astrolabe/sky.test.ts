import { describe, expect, test } from 'bun:test';
import type { Area, Question } from '../lib/questions';
import { questionGraph } from '../lib/questions';
import { useTranslations } from '../i18n/ui';
import { chartQuestions } from './chart';
import { constellationFacts } from './facts';
import { type Box, layoutSkies, layoutSky } from './sky';
import { textWidth } from './text';

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
      const distances = layout.clusters.map((a) => ({
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
        ...layout.clusters.flatMap((a) => a.label?.box ?? []),
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
    const centre = (area: Area | undefined) => layout.clusters.find((a) => a.area === area)!;
    const beliefs = centre('Beliefs');
    const others = layout.clusters
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

/** Constellation 1 holds questions 1, 6, 11 and 12, across three areas; 2 holds 2, 3 and 4. */
const MEMBERS: Record<number, number[]> = { 1: [1, 6, 11, 12], 2: [2, 3, 4] };

function fakeConstellations(qs: Question[], members = MEMBERS) {
  const held = new Set(Object.values(members).flat());
  const open = Object.entries(members).map(([number, ns]) => ({
    number: Number(number),
    url: `https://github.com/TAGC/oneiros/milestone/${number}`,
    state: 'open' as const,
    name: { en: `The constellation numbered ${number}`, zh: `第 ${number} 个星座` },
    reasoning: {},
    size: 'medium' as const,
    energy: 'medium' as const,
    questions: qs.filter((q) => ns.includes(q.number)),
  }));
  return {
    all: () => open,
    open: () => open,
    of: () => undefined,
    ungrouped: () => qs.filter((q) => !held.has(q.number) && q.status === 'open'),
  };
}

function skies(locale: 'en' | 'zh' = 'en', members = MEMBERS) {
  const qs = questions();
  return layoutSkies(
    chartQuestions(qs, questionGraph(qs), locale, fakeConstellations(qs, members)),
  );
}

describe('the sky clustered by constellation', () => {
  test('shares one canvas with the sky clustered by area', () => {
    const { areas, constellations } = skies();
    expect(constellations).toBeDefined();
    expect(constellations!.width).toBe(areas.width);
    expect(constellations!.height).toBe(areas.height);
    expect(areas.by).toBe('areas');
    expect(constellations!.by).toBe('constellations');
  });

  test('gathers each constellation into its own patch of sky, the rest into one more', () => {
    const layout = skies().constellations!;
    expect(layout.clusters.map((c) => c.constellation)).toEqual([1, 2, undefined]);
    const patch = (ns: number[]) => {
      const points = layout.stars.filter((s) => ns.includes(s.number));
      return {
        x1: Math.min(...points.map((p) => p.x)),
        y1: Math.min(...points.map((p) => p.y)),
        x2: Math.max(...points.map((p) => p.x)),
        y2: Math.max(...points.map((p) => p.y)),
      };
    };
    const held = Object.values(MEMBERS).flat();
    const rest = layout.stars.map((s) => s.number).filter((n) => !held.includes(n));
    const patches = [...Object.values(MEMBERS), rest].map(patch);
    for (const a of patches) {
      for (const b of patches) if (a !== b) expect(overlap(a, b)).toBe(false);
    }
  });

  test('keeps stars apart and every label and name clear of each other, on the canvas', () => {
    for (const locale of ['en', 'zh'] as const) {
      const layout = skies(locale).constellations!;
      expect(skies(locale).constellations).toEqual(layout);
      for (const a of layout.stars) {
        for (const b of layout.stars) {
          if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
        }
      }
      const texts = [
        ...layout.stars.map((s) => s.label.box),
        ...layout.constellations.map((c) => c.label.box),
        ...layout.clusters.flatMap((c) => c.label?.box ?? []),
      ];
      for (const a of texts) {
        for (const b of texts) if (a !== b) expect(overlap(a, b)).toBe(false);
        expect(a.x1).toBeGreaterThanOrEqual(0);
        expect(a.y1).toBeGreaterThanOrEqual(0);
        expect(a.x2).toBeLessThanOrEqual(layout.width);
        expect(a.y2).toBeLessThanOrEqual(layout.height);
      }
    }
  });

  test('names only the cluster of stars in no constellation, as constellations name the rest', () => {
    const layout = skies().constellations!;
    expect(layout.clusters.filter((c) => c.label).map((c) => c.constellation)).toEqual([undefined]);
    expect(layout.constellations.map((c) => c.number)).toEqual([1, 2]);
  });

  test('gives each constellation’s name room for its facts line beneath', () => {
    for (const locale of ['en', 'zh'] as const) {
      const qs = questions();
      const chart = chartQuestions(qs, questionGraph(qs), locale, fakeConstellations(qs));
      const t = useTranslations(locale);
      for (const placed of layoutSkies(chart).constellations!.constellations) {
        const c = chart.constellations.find((x) => x.number === placed.number)!;
        const box = placed.label.box;
        expect(box.x2 - box.x1).toBeGreaterThanOrEqual(textWidth(constellationFacts(c, t), 12));
      }
    }
  });

  test('has no clustering by constellation without constellations', () => {
    expect(skies('en', {}).constellations).toBeUndefined();
  });
});
