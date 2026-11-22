import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, questionGraph, writeQuestionCache } from '.';

const LOCALES_BODY = '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。';

type Fixture = {
  blockedBy?: number[];
  underminedBy?: number[];
  state?: 'decided' | 'ruled-out' | 'undermined';
};

function issue(number: number, { blockedBy = [], underminedBy, state }: Fixture = {}): PulledIssue {
  const breakers = underminedBy ?? (state === 'undermined' ? [999] : []);
  const row = breakers.map((n) => `#${n}`).join(', ');
  return {
    number,
    title: `Question ${number}`,
    body: breakers.length
      ? `| Property | Value |\n|---|---|\n| Undermined by | ${row} |\n\n${LOCALES_BODY}`
      : LOCALES_BODY,
    state: state ? 'closed' : 'open',
    state_reason: state === 'ruled-out' ? 'not_planned' : state ? 'completed' : null,
    labels: [{ name: 'kind:open' }, { name: 'area:memory' }],
    html_url: `https://github.com/TAGC/oneiros/issues/${number}`,
    blockedBy: blockedBy.map((n) => ({ number: n })),
  };
}

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
