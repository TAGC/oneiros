import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, questionGraph, type Role, writeQuestionCache } from '.';

const LOCALES_BODY = '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。';

type Fixture = {
  blockedBy?: number[];
  underminedBy?: number[];
  related?: number[];
  state?: 'decided' | 'ruled-out' | 'undermined' | 'duplicate';
  duplicateOf?: number;
};

function issue(
  number: number,
  { blockedBy = [], underminedBy, related = [], state, duplicateOf }: Fixture = {},
): PulledIssue {
  const breakers = underminedBy ?? (state === 'undermined' ? [999] : []);
  const refs = (ns: number[]) => ns.map((n) => `#${n}`).join(', ');
  const rows = [
    ...(related.length ? [`| Related | ${refs(related)} |`] : []),
    ...(breakers.length ? [`| Undermined by | ${refs(breakers)} |`] : []),
  ];
  return {
    number,
    title: `Question ${number}`,
    body: rows.length
      ? `| Property | Value |\n|---|---|\n${rows.join('\n')}\n\n${LOCALES_BODY}`
      : LOCALES_BODY,
    state: state ? 'closed' : 'open',
    state_reason: state ? REASONS[state] : null,
    labels: [{ name: 'kind:open' }, { name: 'area:memory' }],
    html_url: `https://github.com/TAGC/oneiros/issues/${number}`,
    blockedBy: blockedBy.map((n) => ({ number: n })),
    ...(duplicateOf !== undefined && { duplicateOf }),
  };
}

const REASONS = {
  decided: 'completed',
  'ruled-out': 'not_planned',
  undermined: 'completed',
  duplicate: 'duplicate',
} as const;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'graph-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function graphOf(issues: PulledIssue[]) {
  writeQuestionCache(dir, issues);
  return questionGraph(loadQuestions(dir).all());
}

type Graph = ReturnType<typeof graphOf>;

/** Each question's place, by number. */
const places = (graph: Graph) =>
  Object.fromEntries(Object.values(graph.questions).map((q) => [q.number, q.place]));

/** The questions that hold a role, by number. */
const withRole = (graph: Graph, role: Role) =>
  Object.values(graph.questions)
    .filter((q) => q.roles.includes(role))
    .map((q) => q.number);

describe('places', () => {
  test('an open question whose blockers are all decided or ruled out is on the frontier', () => {
    const graph = graphOf([
      issue(1, { state: 'decided' }),
      issue(2, { state: 'ruled-out' }),
      issue(3, { blockedBy: [1, 2] }),
      issue(4),
      issue(5, { blockedBy: [4] }),
      issue(6, { state: 'decided', blockedBy: [4] }),
    ]);
    expect(places(graph)).toEqual({
      1: 'settled',
      2: 'settled',
      3: 'frontier',
      4: 'frontier',
      5: 'blocked',
      6: 'settled',
    });
  });

  test('an undermined or missing blocker is unsettled and keeps a question blocked', () => {
    const graph = graphOf([
      issue(1, { state: 'undermined' }),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [404] }),
    ]);
    expect(places(graph)).toEqual({ 1: 'settled', 2: 'blocked', 3: 'blocked' });
  });

  test('every question has one plain record, safe to hand to client code as JSON', () => {
    const graph = graphOf([issue(1), issue(2, { blockedBy: [1, 404] })]);
    expect(JSON.parse(JSON.stringify(graph))).toEqual(graph);
    expect(graph.questions[2]).toMatchObject({ number: 2, blockedBy: [1, 404], dependents: [] });
  });
});

describe('steps out', () => {
  const steps = (graph: Graph) =>
    Object.fromEntries(Object.values(graph.questions).map((q) => [q.number, q.stepsOut]));

  test('counts the longest chain of unsettled blockers in front of an open question', () => {
    const graph = graphOf([
      issue(1, { state: 'decided' }),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [2] }),
      issue(4, { blockedBy: [3] }),
      issue(5, { blockedBy: [2, 4] }),
      issue(6, { state: 'ruled-out', blockedBy: [5] }),
    ]);
    expect(steps(graph)).toEqual({ 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 0 });
  });

  test('an undermined or missing blocker counts as one step', () => {
    const graph = graphOf([
      issue(1, { state: 'undermined' }),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [404] }),
      issue(4, { blockedBy: [2] }),
    ]);
    expect(steps(graph)).toEqual({ 1: 0, 2: 1, 3: 1, 4: 2 });
  });

  test('a question in a blocked-by cycle, or waiting on one, is blocked at the cap', () => {
    const graph = graphOf([
      issue(1, { blockedBy: [2] }),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [2] }),
      issue(4, { state: 'decided', blockedBy: [5] }),
      issue(5, { blockedBy: [4] }),
      issue(6),
      issue(7, { blockedBy: [7] }),
    ]);
    expect(places(graph)).toEqual({
      1: 'blocked',
      2: 'blocked',
      3: 'blocked',
      4: 'settled',
      5: 'blocked',
      6: 'frontier',
      7: 'blocked',
    });
    expect(steps(graph)).toEqual({ 1: 6, 2: 6, 3: 6, 4: 0, 5: 6, 6: 0, 7: 6 });
  });
});

describe('threads', () => {
  test('run from blocker to blocked, settled only when the blocker is decided or ruled out', () => {
    const graph = graphOf([
      issue(1, { state: 'decided' }),
      issue(2, { state: 'ruled-out' }),
      issue(3, { state: 'undermined', underminedBy: [5] }),
      issue(4, { blockedBy: [1, 2, 3, 404] }),
      issue(5, { blockedBy: [4] }),
      issue(6, { state: 'decided', blockedBy: [5] }),
    ]);
    expect(graph.threads).toEqual([
      { from: 1, to: 4, kind: 'settled' },
      { from: 2, to: 4, kind: 'settled' },
      { from: 3, to: 4, kind: 'unsettled' },
      { from: 4, to: 5, kind: 'unsettled' },
      { from: 5, to: 3, kind: 'undermines' },
      { from: 5, to: 6, kind: 'unsettled' },
    ]);
  });
});

describe('cycles', () => {
  test('lists each blocked-by cycle by its questions, whatever their state', () => {
    const graph = graphOf([
      issue(1, { blockedBy: [3] }),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [2] }),
      issue(4, { blockedBy: [1] }),
      issue(5, { state: 'decided', blockedBy: [6] }),
      issue(6, { blockedBy: [5] }),
      issue(7, { blockedBy: [7] }),
      issue(8, { blockedBy: [404] }),
    ]);
    expect(graph.cycles).toEqual([[1, 2, 3], [5, 6], [7]]);
  });

  test('a graph without cycles has none', () => {
    expect(graphOf([issue(1), issue(2, { blockedBy: [1] })]).cycles).toEqual([]);
  });
});

describe('peripheral', () => {
  test('holds frontier questions that no open question depends on', () => {
    const graph = graphOf([
      issue(1),
      issue(2),
      issue(3, { blockedBy: [2] }),
      issue(4, { state: 'decided' }),
      issue(5, { blockedBy: [4] }),
      issue(6),
      issue(7, { state: 'decided', blockedBy: [6] }),
      issue(8, { state: 'undermined' }),
      issue(9, { blockedBy: [8] }),
    ]);
    expect(withRole(graph, 'peripheral')).toEqual([1, 5, 6]);
  });
});

describe('independent', () => {
  test('holds open questions with no blocked-by or Undermined by links at all', () => {
    const graph = graphOf([
      issue(1),
      issue(2, { blockedBy: [3] }),
      issue(3, { state: 'decided' }),
      issue(4),
      issue(5, { state: 'ruled-out', blockedBy: [4] }),
      issue(6),
      issue(7, { state: 'decided', underminedBy: [6] }),
      issue(8, { underminedBy: [404] }),
      issue(9, { blockedBy: [404] }),
    ]);
    expect(withRole(graph, 'independent')).toEqual([1]);
  });

  test('a Related row to a question in the graph links both questions', () => {
    const graph = graphOf([
      issue(1),
      issue(2, { related: [3] }),
      issue(3),
      issue(4, { related: [5] }),
      issue(5, { state: 'decided' }),
      issue(6, { related: [404] }),
    ]);
    expect(withRole(graph, 'independent')).toEqual([1, 6]);
  });

  test('an independent question is peripheral too', () => {
    expect(graphOf([issue(1)]).questions[1].roles).toEqual(['peripheral', 'independent']);
  });
});

describe('central', () => {
  const fixture = () =>
    graphOf([
      issue(1),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [1] }),
      issue(4, { blockedBy: [1] }),
      issue(5),
      issue(6, { blockedBy: [5] }),
      issue(7, { blockedBy: [5] }),
      issue(8, { state: 'decided', blockedBy: [5] }),
      issue(9, { state: 'decided' }),
      issue(10, { blockedBy: [9] }),
      issue(11, { blockedBy: [9] }),
      issue(12, { blockedBy: [9] }),
      issue(13, { blockedBy: [1] }),
      issue(14, { blockedBy: [13] }),
      issue(15, { blockedBy: [13] }),
      issue(16, { blockedBy: [13] }),
    ]);

  test('holds open questions that directly block at least three open questions', () => {
    expect(withRole(fixture(), 'central')).toEqual([1, 13]);
  });

  test('lists the open questions each question directly blocks', () => {
    const { questions } = fixture();
    expect(questions[1].dependents).toEqual([2, 3, 4, 13]);
    expect(questions[5].dependents).toEqual([6, 7]);
    expect(questions[9].dependents).toEqual([10, 11, 12]);
    expect(questions[16].dependents).toEqual([]);
  });
});

describe('duplicates', () => {
  const graph = () =>
    graphOf([
      issue(1),
      issue(2, { state: 'duplicate', duplicateOf: 1, blockedBy: [3] }),
      issue(3),
      issue(4, { blockedBy: [2] }),
      issue(5, { related: [2] }),
    ]);

  test('are left out of the graph', () => {
    expect(Object.keys(graph().questions)).toEqual(['1', '3', '4', '5']);
  });

  test('carry no links of their own, so what only a duplicate links to stays independent', () => {
    expect(withRole(graph(), 'independent')).toEqual([3]);
  });

  test('a link to a duplicate counts as a link to its canonical question', () => {
    const { questions } = graph();
    expect(questions[4]).toMatchObject({ place: 'blocked', blockedBy: [1] });
    expect(questions[1].dependents).toEqual([4]);
    expect(graph().threads).toEqual([{ from: 1, to: 4, kind: 'unsettled' }]);
  });
});
