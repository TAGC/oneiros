import { describe, expect, test } from 'bun:test';
import type { Area, Question } from '../lib/questions';
import { questionGraph } from '../lib/questions';
import type { Constellation, Constellations } from '../lib/questions/constellations';
import { layoutBrass } from './brass';
import { chartQuestions } from './chart';

function question(number: number, area: Area | undefined, fixture: Partial<Question> = {}) {
  const status = fixture.status ?? 'open';
  const q: Question = {
    number,
    url: `https://github.com/TAGC/oneiros/issues/${number}`,
    kind: 'open',
    state: status === 'open' ? 'open' : 'closed',
    title: { en: `Question ${number}` },
    text: { en: 'English.' },
    properties: {},
    blockedBy: [],
    underminedBy: [],
    ...fixture,
    status,
  };
  if (area) q.area = area;
  return q;
}

function constellation(
  number: number,
  members: Question[],
  fixture: Partial<Constellation> = {},
): Constellation {
  return {
    number,
    url: `https://github.com/TAGC/oneiros/milestone/${number}`,
    state: 'open',
    name: { en: `Group ${number}` },
    reasoning: { en: 'Why.' },
    size: 'medium',
    energy: 'medium',
    questions: members,
    ...fixture,
  };
}

function dial(groups: Constellation[], locale: 'en' | 'zh' = 'en') {
  const questions = [
    ...new Map(groups.flatMap((c) => c.questions).map((q) => [q.number, q])).values(),
  ];
  const fake: Constellations = {
    all: () => groups,
    open: () => groups.filter((c) => c.state === 'open'),
    of: (n) => groups.find((c) => c.questions.some((q) => q.number === n)),
    finished: () => [],
    toClose: () => [],
    ungrouped: () => [],
  };
  return layoutBrass(chartQuestions(questions, questionGraph(questions), locale, fake));
}

const markOf = (layout: ReturnType<typeof dial>, n: number) =>
  layout.marks.find((m) => m.number === n)!;
const sectorOf = (layout: ReturnType<typeof dial>, area: Area | undefined) =>
  layout.sectors.find((s) => s.area === area)!;
type Box = { x1: number; y1: number; x2: number; y2: number };
const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const within = (angle: number, s: { start: number; end: number }) =>
  angle > s.start && angle < s.end;

describe('the constellations dial', () => {
  test('gives each of the 16 areas a sector, in the wiki order, one after another', () => {
    const layout = dial([constellation(1, [question(1, 'Memory')])]);
    expect(layout.sectors.map((s) => s.area)).toEqual([
      'Beliefs',
      'Body',
      'Character',
      'Dreams',
      'Economy',
      'Emotion',
      'Items',
      'Library',
      'Lore',
      'Lucidity',
      'Magic',
      'Memory',
      'Philosophy',
      'Rest',
      'Temenos',
      'World',
    ]);
    for (const [i, s] of layout.sectors.entries()) {
      expect(s.end).toBeGreaterThan(s.start);
      if (i) expect(s.start).toBeCloseTo(layout.sectors[i - 1].end);
    }
  });

  test("gives every sector room for its area's name on the band, even with none in it", () => {
    for (const locale of ['en', 'zh'] as const) {
      const layout = dial(
        Array.from({ length: 40 }, (_, i) => constellation(i + 1, [question(i + 1, 'Memory')])),
        locale,
      );
      const middle = (layout.plate + layout.band) / 2;
      const arc = (area: Area) => {
        const s = sectorOf(layout, area);
        return ((s.end - s.start) * Math.PI * middle) / 180;
      };
      // Roughly the width of PHILOSOPHY and 哲学 in capitals on the band.
      expect(arc('Philosophy')).toBeGreaterThan(locale === 'en' ? 100 : 40);
      if (locale === 'en') expect(arc('Lore')).toBeLessThan(arc('Philosophy'));
    }
  });

  test('places a constellation in the sector of the area holding most of its questions', () => {
    const layout = dial([
      constellation(1, [question(1, 'Memory'), question(2, 'Temenos'), question(3, 'Temenos')]),
    ]);
    const mark = markOf(layout, 1);
    expect(mark.area).toBe('Temenos');
    expect(mark.areas).toEqual(['Temenos', 'Memory']);
    expect(within(mark.angle, sectorOf(layout, 'Temenos'))).toBe(true);
  });

  test('breaks a tie between areas by the wiki order', () => {
    const layout = dial([
      constellation(1, [question(1, 'Memory'), question(2, 'Character')]),
      constellation(2, [question(3, 'World'), question(4, 'Beliefs', { status: 'decided' })]),
    ]);
    expect(markOf(layout, 1).area).toBe('Character');
    expect(markOf(layout, 2).area).toBe('Beliefs');
  });

  test('gives an area with more constellations a wider sector, and an empty area a narrow one', () => {
    const layout = dial([
      constellation(1, [question(1, 'Magic')]),
      constellation(2, [question(2, 'Magic')], { energy: 'low' }),
      constellation(3, [question(3, 'Magic')], { energy: 'high' }),
      constellation(4, [question(4, 'Body')]),
    ]);
    const width = (area: Area) => sectorOf(layout, area).end - sectorOf(layout, area).start;
    expect(width('Magic')).toBeGreaterThan(width('Body'));
    expect(width('Body')).toBeGreaterThan(width('Lore'));
    expect(width('Lore')).toBeGreaterThan(0);
  });

  test('puts each constellation on its energy ring, low near the hub and high at the rim', () => {
    const layout = dial([
      constellation(1, [question(1, 'Magic')], { energy: 'low' }),
      constellation(2, [question(2, 'Magic')], { energy: 'medium' }),
      constellation(3, [question(3, 'Magic')], { energy: 'high' }),
    ]);
    expect(layout.rings.map((r) => r.energy)).toEqual(['low', 'medium', 'high']);
    const [low, medium, high] = layout.rings.map((r) => r.r);
    expect(layout.hub).toBeLessThan(low);
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    expect(high).toBeLessThan(layout.plate);
    const distance = (n: number) =>
      Math.hypot(markOf(layout, n).x - layout.centre, markOf(layout, n).y - layout.centre);
    expect(distance(1)).toBeCloseTo(low, 0);
    expect(distance(2)).toBeCloseTo(medium, 0);
    expect(distance(3)).toBeCloseTo(high, 0);
  });

  test('adds a ring inside the low one, and a sector, only for constellations missing them', () => {
    const plain = dial([constellation(1, [question(1, 'Magic')])]);
    expect(plain.rings.map((r) => r.energy)).toEqual(['low', 'medium', 'high']);
    expect(plain.sectors).toHaveLength(16);

    const layout = dial([
      constellation(1, [question(1, 'Magic')], { energy: undefined }),
      constellation(2, [question(2, undefined)], { energy: 'low' }),
    ]);
    expect(layout.rings.map((r) => r.energy)).toEqual([undefined, 'low', 'medium', 'high']);
    expect(layout.rings[0].r).toBeLessThan(layout.rings[1].r);
    expect(markOf(layout, 1).energy).toBeUndefined();
    expect(layout.sectors.at(-1)!.area).toBeUndefined();
    expect(markOf(layout, 2).area).toBeUndefined();
    expect(within(markOf(layout, 2).angle, layout.sectors.at(-1)!)).toBe(true);
  });

  test('draws a larger constellation as a larger mark', () => {
    const layout = dial([
      constellation(1, [question(1, 'Magic')], { size: 'small' }),
      constellation(2, [question(2, 'Magic')], { size: 'medium' }),
      constellation(3, [question(3, 'Magic')], { size: 'large' }),
    ]);
    expect(markOf(layout, 1).r).toBeLessThan(markOf(layout, 2).r);
    expect(markOf(layout, 2).r).toBeLessThan(markOf(layout, 3).r);
  });

  describe('labels', () => {
    type Layout = ReturnType<typeof dial>;
    const markBox = (m: Layout['marks'][number]): Box => ({
      x1: m.x - m.r,
      y1: m.y - m.r,
      x2: m.x + m.r,
      y2: m.y + m.r,
    });
    const corners = (b: Box) => [
      [b.x1, b.y1],
      [b.x2, b.y1],
      [b.x1, b.y2],
      [b.x2, b.y2],
    ];

    /** As crowded as the first real constellations: many in a few areas, on every ring. */
    function crowded(locale: 'en' | 'zh' = 'en') {
      const plan: [Area, number, number, number][] = [
        ['Memory', 1, 4, 4],
        ['Magic', 1, 1, 5],
        ['Character', 3, 1, 2],
        ['Temenos', 1, 3, 2],
        ['World', 1, 2, 2],
        ['Beliefs', 0, 3, 0],
        ['Economy', 1, 2, 0],
        ['Items', 0, 1, 2],
        ['Body', 0, 1, 0],
        ['Lucidity', 1, 0, 0],
        ['Rest', 0, 1, 0],
      ];
      const words = ['Merging', 'repeated', 'experiences', 'and', 'the', 'old', 'Sleep', 'magic'];
      const groups: Constellation[] = [];
      let n = 0;
      for (const [area, low, medium, high] of plan) {
        for (const [energy, count] of [
          ['low', low],
          ['medium', medium],
          ['high', high],
        ] as const) {
          for (let k = 0; k < count; k++) {
            n++;
            const name = words.slice(0, 1 + (n % 4)).join(' ');
            groups.push(
              constellation(n, [question(n, area)], {
                energy,
                size: (['small', 'medium', 'large'] as const)[n % 3],
                name: {
                  en: name,
                  zh: '合并重复的经历与旧睡眠魔法'.slice(0, 3 + (n % 9)),
                },
              }),
            );
          }
        }
      }
      return dial(groups, locale);
    }

    for (const locale of ['en', 'zh'] as const) {
      test(`writes every name where it overlaps no other name and no mark (${locale})`, () => {
        const layout = crowded(locale);
        expect(layout.marks).toHaveLength(45);
        for (const m of layout.marks) {
          expect(m.label.lines.length).toBeGreaterThan(0);
          for (const other of layout.marks) {
            if (other === m) continue;
            expect(overlaps(m.label.box, other.label.box)).toBe(false);
            expect(overlaps(m.label.box, markBox(other))).toBe(false);
          }
          expect(overlaps(m.label.box, markBox(m))).toBe(false);
        }
      });

      test(`keeps every name on the plate, outside the hub (${locale})`, () => {
        const layout = crowded(locale);
        for (const m of layout.marks) {
          for (const [x, y] of corners(m.label.box)) {
            expect(Math.hypot(x - layout.centre, y - layout.centre)).toBeLessThan(layout.plate);
          }
          const nearest = {
            x: Math.max(m.label.box.x1, Math.min(layout.centre, m.label.box.x2)),
            y: Math.max(m.label.box.y1, Math.min(layout.centre, m.label.box.y2)),
          };
          expect(Math.hypot(nearest.x - layout.centre, nearest.y - layout.centre)).toBeGreaterThan(
            layout.hub,
          );
        }
      });
    }

    test('writes a name beside its own mark', () => {
      const layout = crowded();
      for (const m of layout.marks) {
        const b = m.label.box;
        const gap = Math.hypot(
          Math.max(b.x1 - m.x, 0, m.x - b.x2),
          Math.max(b.y1 - m.y, 0, m.y - b.y2),
        );
        expect(gap).toBeLessThan(m.r + (m.label.leader ? 80 : 24));
      }
    });

    test('wraps a long Chinese name into even lines', () => {
      const layout = dial(
        [
          constellation(1, [question(1, 'Magic')], {
            name: { en: 'Crack', zh: '开裂、枯与晦暗减益' },
          }),
        ],
        'zh',
      );
      const lines = markOf(layout, 1).label.lines;
      expect(lines).toHaveLength(2);
      expect(lines.join('')).toBe('开裂、枯与晦暗减益');
      expect(Math.abs([...lines[0]].length - [...lines[1]].length)).toBeLessThanOrEqual(1);
    });

    test('wraps a long name onto more than one line', () => {
      const layout = dial([
        constellation(1, [question(1, 'Magic')], {
          name: { en: 'Unmaking and the old Sleep magic of the Dreamlands' },
        }),
      ]);
      expect(markOf(layout, 1).label.lines.length).toBeGreaterThan(1);
      expect(markOf(layout, 1).label.lines.join(' ')).toBe(
        'Unmaking and the old Sleep magic of the Dreamlands',
      );
    });
  });

  test("keeps a rule at the top clear for each ring's energy", () => {
    const layout = dial([
      constellation(1, [question(1, 'Beliefs')], {
        energy: 'low',
        name: { en: 'A long name for a mark' },
      }),
      constellation(2, [question(2, 'World')], {
        energy: 'low',
        size: 'large',
      }),
      constellation(3, [question(3, 'Beliefs')], { energy: 'high' }),
      constellation(4, [question(4, 'World')], { energy: 'high' }),
      constellation(5, [question(5, 'Body')], { energy: undefined }),
    ]);
    expect(layout.sectors[0].start).toBeCloseTo(layout.rule);
    expect(layout.sectors.at(-1)!.end).toBeCloseTo(360 - layout.rule);
    for (const ring of layout.rings) {
      const b = ring.labelBox;
      expect(b.x1).toBeLessThan(layout.centre);
      expect(b.x2).toBeGreaterThan(layout.centre);
      expect(b.y1).toBeLessThan(layout.centre - ring.r);
      expect(b.y2).toBeGreaterThan(layout.centre - ring.r);
      for (const m of layout.marks) {
        expect(overlaps(m.label.box, b)).toBe(false);
        expect(overlaps({ x1: m.x - m.r, y1: m.y - m.r, x2: m.x + m.r, y2: m.y + m.r }, b)).toBe(
          false,
        );
      }
    }
  });
});
