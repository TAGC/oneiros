import { describe, expect, test } from 'bun:test';
import { type Question, questionGraph } from '../lib/questions';
import { chartQuestions } from './chart';

type Fixture = Partial<Question> & { status?: Question['status'] };

function question(number: number, fixture: Fixture = {}): Question {
  const status = fixture.status ?? 'open';
  return {
    number,
    url: `https://github.com/TAGC/oneiros/issues/${number}`,
    kind: 'open',
    area: 'Memory',
    state: status === 'open' ? 'open' : 'closed',
    status,
    title: { en: `Question ${number}`, zh: `问题 ${number}` },
    text: { en: 'English.', zh: '中文。' },
    properties: {},
    blockedBy: [],
    underminedBy: [],
    ...fixture,
  };
}

function chart(questions: Question[], locale: 'en' | 'zh' = 'en') {
  return chartQuestions(questions, questionGraph(questions), locale);
}

describe('star status', () => {
  test('splits open questions into frontier and blocked, and keeps closed statuses', () => {
    const c = chart([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [2] }),
      question(4, { status: 'ruled-out' }),
      question(5, { status: 'undermined', underminedBy: [2] }),
    ]);
    const status = Object.fromEntries(c.stars.map((s) => [s.number, s.status]));
    expect(status).toEqual({
      1: 'decided',
      2: 'frontier',
      3: 'blocked',
      4: 'ruled-out',
      5: 'undermined',
    });
  });

  test('counts each status and the open questions', () => {
    const c = chart([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [2] }),
      question(4),
    ]);
    expect(c.counts).toEqual({
      open: 3,
      frontier: 2,
      blocked: 1,
      decided: 1,
      'ruled-out': 0,
      undermined: 0,
    });
  });
});

describe('star roles', () => {
  test('marks central, peripheral and independent questions; independent wins over peripheral', () => {
    const c = chart([
      question(1),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [1] }),
      question(4, { blockedBy: [1] }),
      question(5, { status: 'decided' }),
      question(6, { blockedBy: [5] }),
      question(7),
    ]);
    const roles = Object.fromEntries(c.stars.map((s) => [s.number, s.roles]));
    expect(roles).toEqual({
      1: ['central'],
      2: [],
      3: [],
      4: [],
      5: [],
      6: ['peripheral'],
      7: ['independent'],
    });
  });
});

describe('threads', () => {
  test('run from blocker to blocked, open while the blocker is open, and from breaker to undermined', () => {
    const c = chart([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [2, 99] }),
      question(4, { status: 'undermined', underminedBy: [2] }),
    ]);
    expect(c.threads).toEqual([
      { from: 1, to: 2, kind: 'settled' },
      { from: 2, to: 3, kind: 'open' },
      { from: 2, to: 4, kind: 'undermines' },
    ]);
  });

  test('list what each star blocks and undermines, and only blockers in the chart', () => {
    const c = chart([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [2, 99] }),
      question(4, { status: 'undermined', underminedBy: [2] }),
    ]);
    const two = c.stars.find((s) => s.number === 2)!;
    const three = c.stars.find((s) => s.number === 3)!;
    expect(two.blocks).toEqual([3]);
    expect(two.undermines).toEqual([4]);
    expect(three.blockedBy).toEqual([2]);
  });
});

describe('labels and areas', () => {
  test("label each star with the locale's title, falling back to English", () => {
    const c = chart([question(1), question(2, { title: { en: 'Only English' } })], 'zh');
    expect(c.stars.map((s) => [s.label, s.labelLang])).toEqual([
      ['问题 1', 'zh'],
      ['Only English', 'en'],
    ]);
  });

  test('group stars by area in the wiki order, with questions of no area last', () => {
    const c = chart([
      question(1, { area: 'World' }),
      question(2, { area: undefined }),
      question(3, { area: 'Beliefs' }),
      question(4, { area: 'World' }),
    ]);
    expect(c.areas.map((a) => [a.area, a.stars])).toEqual([
      ['Beliefs', [3]],
      ['World', [1, 4]],
      [undefined, [2]],
    ]);
  });
});
