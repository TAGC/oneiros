import { describe, expect, test } from 'bun:test';
import type { Area, Question } from '../lib/questions';
import { questionGraph } from '../lib/questions';
import { isFinished } from '../lib/questions/constellations';
import { chartQuestions } from './chart';
import { layoutTiers } from './tiers';

type Fixture = Partial<Question>;

function question(number: number, fixture: Fixture = {}): Question {
  const status = fixture.status ?? 'open';
  return {
    number,
    url: `https://github.com/TAGC/oneiros/issues/${number}`,
    kind: 'open',
    area: 'Memory',
    state: status === 'open' ? 'open' : 'closed',
    title: { en: `Is question ${number} long enough to wrap onto a second line here?` },
    text: { en: 'English.' },
    properties: {},
    blockedBy: [],
    underminedBy: [],
    ...fixture,
    status,
  };
}

function tiers(questions: Question[]) {
  return layoutTiers(chartQuestions(questions, questionGraph(questions), 'en'));
}

const tierOf = (layout: ReturnType<typeof tiers>) =>
  Object.fromEntries(layout.stars.map((s) => [s.number, s.tier]));

describe('the tiers layout', () => {
  test('puts settled ground first, then the frontier, then each step out, three or more last', () => {
    const layout = tiers([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [2] }),
      question(4, { blockedBy: [3] }),
      question(5, { blockedBy: [4] }),
      question(6, { blockedBy: [5] }),
      question(7, { status: 'ruled-out' }),
    ]);
    expect(tierOf(layout)).toEqual({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 4, 7: 0 });
    expect(layout.columns.map((c) => c.tier)).toEqual([0, 1, 2, 3, 4]);
  });

  test('shows only the steps out that hold a question', () => {
    const layout = tiers([question(1), question(2, { blockedBy: [1] })]);
    expect(layout.columns.map((c) => c.tier)).toEqual([0, 1, 2]);
  });

  test('gives each area a row, in the chart order, and keeps stars inside their row', () => {
    const areas: (Area | undefined)[] = ['World', 'Beliefs', undefined, 'World'];
    const layout = tiers(
      areas.map((area, i) => {
        const q = question(i + 1);
        if (area) q.area = area;
        else delete q.area;
        return q;
      }),
    );
    expect(layout.rows.map((r) => r.area)).toEqual(['Beliefs', 'World', undefined]);
    const rowOf = { 1: 1, 2: 0, 3: 2, 4: 1 } as Record<number, number>;
    for (const s of layout.stars) {
      const row = layout.rows[rowOf[s.number]];
      expect(s.label.box.y1).toBeGreaterThanOrEqual(row.y);
      expect(s.label.box.y2).toBeLessThanOrEqual(row.y + row.height);
    }
  });

  test('stacks stars that share a cell without overlap and keeps them inside their column', () => {
    const layout = tiers([question(1), question(2), question(3), question(4)]);
    const boxes = layout.stars.map((s) => s.label.box);
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b) continue;
        expect(a.y2 <= b.y1 || b.y2 <= a.y1).toBe(true);
      }
    }
    const column = layout.columns.find((c) => c.tier === 1)!;
    for (const b of boxes) {
      expect(b.x1).toBeGreaterThanOrEqual(column.x);
      expect(b.x2).toBeLessThanOrEqual(column.x + column.width);
    }
  });

  test('draws a thread for each link', () => {
    const layout = tiers([question(1), question(2, { blockedBy: [1] })]);
    expect(layout.threads).toHaveLength(1);
    expect(layout.threads[0].d).toMatch(/^M[\d.]+,[\d.]+/);
  });
});

function constellations(questions: Question[], members: Record<number, number[]>) {
  const open = Object.entries(members).map(([number, ns]) => ({
    number: Number(number),
    url: `https://github.com/TAGC/oneiros/milestone/${number}`,
    state: 'open' as const,
    name: { en: `A constellation with a name long enough to wrap, number ${number}` },
    reasoning: {},
    questions: questions.filter((q) => ns.includes(q.number)),
  }));
  const held = new Set(Object.values(members).flat());
  return {
    all: () => open,
    open: () => open.filter((c) => !isFinished(c)),
    of: () => undefined,
    finished: () => open.filter(isFinished),
    toClose: () => [],
    ungrouped: () => questions.filter((q) => !held.has(q.number) && q.status === 'open'),
  };
}

function byConstellation(questions: Question[], members: Record<number, number[]>) {
  const chart = chartQuestions(
    questions,
    questionGraph(questions),
    'en',
    constellations(questions, members),
  );
  return layoutTiers(chart, 'constellations');
}

describe('the tiers layout by constellation', () => {
  test('gives each constellation a row, then one row for the questions in none', () => {
    const qs = [1, 2, 3, 4, 5].map((n) => question(n));
    const layout = byConstellation(qs, { 7: [4, 2], 3: [5] });
    expect(layout.rows.map((r) => r.constellation)).toEqual([3, 7, undefined]);
    const rowOf = { 1: 2, 2: 1, 3: 2, 4: 1, 5: 0 } as Record<number, number>;
    for (const s of layout.stars) {
      const row = layout.rows[rowOf[s.number]];
      expect(s.label.box.y1).toBeGreaterThanOrEqual(row.y);
      expect(s.label.box.y2).toBeLessThanOrEqual(row.y + row.height);
    }
  });

  test('wraps a long constellation name inside the name column and its row', () => {
    const layout = byConstellation([question(1)], { 2: [1] });
    const [row] = layout.rows;
    expect(row.name!.lines.length).toBeGreaterThan(1);
    expect(row.height).toBeGreaterThanOrEqual(row.name!.lines.length * 18 + 18);
    expect(layout.columns[0].x).toBe(layout.areaWidth);
  });

  test('puts finished constellations last, below the questions in none', () => {
    const qs = [question(1), question(2, { status: 'decided' }), question(3)];
    const layout = byConstellation(qs, { 4: [1], 5: [2] });
    expect(layout.rows.map((r) => [r.constellation, r.finished ?? false])).toEqual([
      [4, false],
      [undefined, false],
      [5, true],
    ]);
  });

  test('keeps the same tiers as by area', () => {
    const qs = [question(1), question(2, { blockedBy: [1] }), question(3, { status: 'decided' })];
    const byArea = tiers(qs);
    const layout = byConstellation(qs, { 1: [2] });
    expect(tierOf(layout)).toEqual(tierOf(byArea));
    expect(layout.columns.map((c) => c.tier)).toEqual(byArea.columns.map((c) => c.tier));
  });
});
