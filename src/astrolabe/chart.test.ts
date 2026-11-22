import { describe, expect, test } from 'bun:test';
import { type Question, questionGraph } from '../lib/questions';
import {
  type Constellation,
  type Constellations,
  isFinished,
} from '../lib/questions/constellations';
import { chartQuestions, quietSettled } from './chart';

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

describe('duplicates', () => {
  test('leave the chart, with their threads', () => {
    const c = chart([
      question(1),
      question(2, { status: 'duplicate', closeReason: 'duplicate', duplicateOf: 1 }),
      question(3, { blockedBy: [2] }),
    ]);
    expect(c.stars.map((s) => s.number)).toEqual([1, 3]);
    expect(c.threads).toEqual([]);
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
  test("are the graph's threads between stars on the chart, an undermined blocker's unsettled", () => {
    const c = chart([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { blockedBy: [2, 99] }),
      question(4, { status: 'undermined', underminedBy: [2] }),
      question(5, { blockedBy: [4] }),
    ]);
    expect(c.threads).toEqual([
      { from: 1, to: 2, kind: 'settled' },
      { from: 2, to: 3, kind: 'unsettled' },
      { from: 2, to: 4, kind: 'undermines' },
      { from: 4, to: 5, kind: 'unsettled' },
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

describe('constellations', () => {
  function sky(questions: Question[], constellations: Constellation[], locale: 'en' | 'zh' = 'en') {
    const open = constellations.filter((c) => !isFinished(c));
    const grouped = new Set(open.flatMap((c) => c.questions.map((q) => q.number)));
    const fake: Constellations = {
      all: () => constellations,
      open: () => open,
      of: (n) => constellations.find((c) => c.questions.some((q) => q.number === n)),
      finished: () => constellations.filter(isFinished),
      toClose: () => [],
      ungrouped: () => questions.filter((q) => q.state === 'open' && !grouped.has(q.number)),
    };
    return chartQuestions(questions, questionGraph(questions), locale, fake);
  }

  function constellation(
    number: number,
    members: Question[],
    fixture: Partial<Constellation> = {},
  ) {
    return {
      number,
      url: `https://github.com/TAGC/oneiros/milestone/${number}`,
      state: 'open' as const,
      name: { en: `Group ${number}`, zh: `星座 ${number}` },
      reasoning: { en: 'Why.' },
      questions: members,
      ...fixture,
    };
  }

  test('lists open constellations with their name, scales and progress, by stars on the map', () => {
    const qs = [question(1), question(2, { status: 'decided' }), question(3), question(4)];
    const c = sky(
      qs,
      [
        constellation(7, [qs[0], qs[1]], { size: 'small', energy: 'low' }),
        constellation(8, [qs[2]], { name: { en: 'Only English' } }),
        constellation(9, [qs[3]], { state: 'closed' }),
      ],
      'zh',
    );
    expect(
      c.constellations.map((k) => ({
        number: k.number,
        name: k.name,
        nameLang: k.nameLang,
        size: k.size,
        energy: k.energy,
        settled: k.settled,
        stars: k.stars,
      })),
    ).toEqual([
      {
        number: 7,
        name: '星座 7',
        nameLang: 'zh',
        size: 'small',
        energy: 'low',
        settled: 1,
        stars: [1, 2],
      },
      {
        number: 8,
        name: 'Only English',
        nameLang: 'en',
        size: undefined,
        energy: undefined,
        settled: 0,
        stars: [3],
      },
    ]);
  });

  test('marks open questions that no open constellation holds', () => {
    const qs = [question(1), question(2), question(3, { status: 'decided' })];
    const c = sky(qs, [constellation(7, [qs[0]]), constellation(9, [qs[1]], { state: 'closed' })]);
    expect(c.ungrouped).toEqual([2]);
    expect(c.stars.find((s) => s.number === 1)!.constellation).toBe(7);
    expect(c.stars.find((s) => s.number === 2)!.constellation).toBeUndefined();
  });

  test('keeps settled questions with their finished constellation, and a reopened one ungrouped', () => {
    const qs = [
      question(1, { status: 'decided' }),
      question(2, { status: 'ruled-out' }),
      question(3),
      question(4, { status: 'decided' }),
      question(5),
    ];
    const c = sky(qs, [
      constellation(7, [qs[0], qs[1]], { size: 'small', energy: 'low' }),
      constellation(8, [qs[2], qs[3]], { state: 'closed' }),
      constellation(9, [qs[4]]),
    ]);
    expect(c.constellations.map((k) => k.number)).toEqual([9]);
    expect(c.finished.map((k) => [k.number, k.stars])).toEqual([
      [7, [1, 2]],
      [8, [4]],
    ]);
    const of = (n: number) => c.stars.find((s) => s.number === n)!;
    expect([of(1).finishedIn, of(4).finishedIn, of(3).finishedIn]).toEqual([7, 8, undefined]);
    expect(of(3).constellation).toBeUndefined();
    expect(c.ungrouped).toEqual([3]);
  });

  test('has no constellations and no warnings without constellation data', () => {
    const c = chart([question(1)]);
    expect(c.constellations).toEqual([]);
    expect(c.ungrouped).toEqual([]);
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

describe('which settled questions show by default', () => {
  test('keeps a settled question linked by a thread to an open one, and quiets the rest', () => {
    const c = chart([
      question(1, { status: 'decided' }),
      question(2, { blockedBy: [1] }),
      question(3, { status: 'ruled-out' }),
      question(4, { status: 'decided' }),
      question(5, { status: 'decided', blockedBy: [4] }),
      question(6, { status: 'undermined', underminedBy: [7] }),
      question(7),
      question(8, { status: 'decided', blockedBy: [9] }),
      question(9),
    ]);
    expect(quietSettled(c)).toEqual([3, 4, 5]);
  });

  test('never quiets an open question, linked or not', () => {
    const c = chart([question(1), question(2, { status: 'decided' })]);
    expect(quietSettled(c)).toEqual([2]);
  });
});
