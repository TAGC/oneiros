import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type GithubIssue, loadQuestions, writeQuestionCache } from '.';

const URL = 'https://github.com/TAGC/oneiros/issues';

function issue(fields: Partial<GithubIssue> & { number: number }): GithubIssue {
  return {
    title: `Question ${fields.number}`,
    body: '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。',
    state: 'open',
    state_reason: null,
    labels: [{ name: 'kind:open' }, { name: 'area:memory' }],
    html_url: `${URL}/${fields.number}`,
    ...fields,
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'questions-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function roundTrip(issues: GithubIssue[]) {
  writeQuestionCache(dir, issues);
  return loadQuestions(dir);
}

describe('question cache round trip', () => {
  test('an open question keeps its kind, area, titles and text in each locale', () => {
    const body = [
      '## en',
      '',
      'Does [[vividness]] fade overnight?',
      '',
      'A second paragraph.',
      '',
      '## zh',
      '',
      '### 鲜明度会在一夜间消退吗',
      '',
      '[[鲜明度]]会在一夜间消退吗？',
    ].join('\r\n');
    const q = roundTrip([issue({ number: 142, title: 'Does vividness fade?', body })]).get(142);

    expect(q).toEqual({
      number: 142,
      url: `${URL}/142`,
      kind: 'open',
      area: 'Memory',
      state: 'open',
      title: { en: 'Does vividness fade?', zh: '鲜明度会在一夜间消退吗' },
      text: {
        en: 'Does [[vividness]] fade overnight?\n\nA second paragraph.',
        zh: '[[鲜明度]]会在一夜间消退吗？',
      },
    });
  });

  test('a conflict takes its kind from the kind:conflict label', () => {
    const labels = [{ name: 'area:temenos' }, { name: 'kind:conflict' }];
    const q = roundTrip([issue({ number: 7, labels })]).get(7);
    expect(q?.kind).toBe('conflict');
    expect(q?.area).toBe('Temenos');
  });

  test('a closed question is closed, with its close reason', () => {
    const questions = roundTrip([
      issue({ number: 1, state: 'closed', state_reason: 'completed' }),
      issue({ number: 2, state: 'closed', state_reason: 'not_planned' }),
      issue({ number: 3, state: 'open', state_reason: 'reopened' }),
    ]);
    expect(questions.get(1)).toMatchObject({ state: 'closed', closeReason: 'completed' });
    expect(questions.get(2)).toMatchObject({ state: 'closed', closeReason: 'not_planned' });
    expect(questions.get(3)?.state).toBe('open');
    expect(questions.get(3)?.closeReason).toBeUndefined();
  });

  test('a missing locale section or Chinese title is left out', () => {
    const q = roundTrip([issue({ number: 9, body: '## en\n\nOnly English.' })]).get(9);
    expect(q?.title).toEqual({ en: 'Question 9' });
    expect(q?.text).toEqual({ en: 'Only English.' });
  });

  test('lists every question by number and skips pull requests', () => {
    const questions = roundTrip([
      issue({ number: 20 }),
      issue({ number: 3 }),
      issue({ number: 11, pull_request: {} }),
    ]);
    expect(questions.all().map((q) => q.number)).toEqual([3, 20]);
    expect(questions.get(11)).toBeUndefined();
  });

  test('labels may be plain strings, as GitHub allows', () => {
    const q = roundTrip([issue({ number: 5, labels: ['kind:conflict', 'area:body'] })]).get(5);
    expect(q).toMatchObject({ kind: 'conflict', area: 'Body' });
  });
});

describe('question cache', () => {
  test('writes one file per question issue and wipes stale ones', () => {
    writeFileSync(join(dir, '99.md'), 'stale');
    writeQuestionCache(dir, [issue({ number: 1 }), issue({ number: 2 })]);
    expect(readdirSync(dir).sort()).toEqual(['1.md', '2.md']);
    expect(loadQuestions(dir).get(99)).toBeUndefined();
  });

  test('a missing cache loads as no questions', () => {
    expect(loadQuestions(join(dir, 'absent')).all()).toEqual([]);
  });
});
