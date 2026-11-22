import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, questionGraph, writeQuestionCache } from '.';

const LOCALES_BODY = '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。';

type Fixture = { blockedBy?: number[]; state?: 'decided' | 'ruled-out' | 'undermined' };

function issue(number: number, { blockedBy = [], state }: Fixture = {}): PulledIssue {
  const undermined = state === 'undermined';
  return {
    number,
    title: `Question ${number}`,
    body: undermined
      ? `| Property | Value |\n|---|---|\n| Undermined by | #999 |\n\n${LOCALES_BODY}`
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
