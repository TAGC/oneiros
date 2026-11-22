import { describe, expect, test } from 'bun:test';
import type { Area, Question } from '../lib/questions';
import { questionGraph } from '../lib/questions';
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
  test('puts settled ground first, then the frontier, then each step out', () => {
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

  test('puts a question waiting only on an undermined decision one step out', () => {
    const layout = tiers([
      question(1, { status: 'undermined', underminedBy: [3] }),
      question(2, { blockedBy: [1] }),
      question(3),
    ]);
    expect(tierOf(layout)).toEqual({ 1: 0, 2: 2, 3: 1 });
  });

  test('survives a cycle of blockers', () => {
    const layout = tiers([question(1, { blockedBy: [2] }), question(2, { blockedBy: [1] })]);
    expect(Object.values(tierOf(layout)).every((t) => t >= 2)).toBe(true);
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
