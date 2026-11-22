import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, questionGraph, writeQuestionCache } from '.';

const LOCALES_BODY = '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。';

type Fixture = {
  blockedBy?: number[];
  underminedBy?: number[];
  state?: 'decided' | 'ruled-out' | 'undermined' | 'duplicate';
  duplicateOf?: number;
};

function issue(
  number: number,
  { blockedBy = [], underminedBy, state, duplicateOf }: Fixture = {},
): PulledIssue {
  const breakers = underminedBy ?? (state === 'undermined' ? [999] : []);
  const row = breakers.map((n) => `#${n}`).join(', ');
  return {
    number,
    title: `Question ${number}`,
    body: breakers.length
      ? `| Property | Value |\n|---|---|\n| Undermined by | ${row} |\n\n${LOCALES_BODY}`
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

describe('frontier', () => {
  test('holds open questions whose blockers are all decided or ruled out', () => {
    const graph = graphOf([
      issue(1, { state: 'decided' }),
      issue(2, { state: 'ruled-out' }),
      issue(3, { blockedBy: [1, 2] }),
      issue(4),
      issue(5, { blockedBy: [4] }),
      issue(6, { state: 'decided', blockedBy: [4] }),
    ]);
    expect(graph.frontier).toEqual([3, 4]);
  });

  test('an undermined or missing blocker keeps a question off the frontier', () => {
    const graph = graphOf([
      issue(1, { state: 'undermined' }),
      issue(2, { blockedBy: [1] }),
      issue(3, { blockedBy: [404] }),
    ]);
    expect(graph.frontier).toEqual([]);
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
    expect(graph.peripheral).toEqual([1, 5, 6]);
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
    expect(graph.independent).toEqual([1]);
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
    expect(fixture().central).toEqual([1, 13]);
  });

  test('lists the open questions each question directly blocks', () => {
    const { dependents } = fixture();
    expect(dependents[1]).toEqual([2, 3, 4, 13]);
    expect(dependents[5]).toEqual([6, 7]);
    expect(dependents[9]).toEqual([10, 11, 12]);
    expect(dependents[16]).toEqual([]);
  });
});

describe('duplicates', () => {
  const graph = () =>
    graphOf([
      issue(1),
      issue(2, { state: 'duplicate', duplicateOf: 1, blockedBy: [3] }),
      issue(3),
      issue(4, { blockedBy: [2] }),
    ]);

  test('are left out of the graph', () => {
    expect(Object.keys(graph().dependents)).toEqual(['1', '3', '4']);
  });

  test('carry no links, so what only a duplicate links to stays independent', () => {
    expect(graph().independent).toEqual([1, 3]);
  });

  test('a duplicate blocker counts as missing and keeps a question off the frontier', () => {
    expect(graph().frontier).toEqual([1, 3]);
  });
});
