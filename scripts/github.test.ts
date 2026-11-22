import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions } from '../src/lib/questions';
import { writeConstellation } from '../src/lib/questions/constellation-format';
import { loadConstellations } from '../src/lib/questions/constellations';
import { type FakeIssue, fakeGitHub } from './github-fake';
import { pull } from './pull';

let dir: string;
let cache: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oneiros-github-'));
  cache = join(dir, '.questions');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function body(rows: Record<string, string>, en = 'English text.', zh = '中文。'): string {
  const table = Object.entries(rows).map(([name, value]) => `| ${name} | ${value} |`);
  return [
    '| Property | Value |\n|---|---|',
    ...table,
    `\n## en\n\n${en}\n\n## zh\n\n### 中文标题\n\n${zh}`,
  ].join('\n');
}

function question(number: number, fields: Partial<FakeIssue> = {}): FakeIssue {
  return {
    number,
    title: `Question ${number}`,
    body: body({ Raised: '22 Nov 2026' }),
    labels: ['kind:open', 'area:memory'],
    ...fields,
  };
}

const FADING = writeConstellation({
  name: { en: 'Fading memories', zh: '褪色的记忆' },
  reasoning: { en: 'How memories fade.', zh: '记忆如何褪色。' },
  size: 'small',
  energy: 'low',
});

describe('the pull', () => {
  test('writes the question issues and milestones the fake holds into the cache', () => {
    const github = fakeGitHub({
      issues: [
        question(1, { milestone: 1, blockedBy: [2] }),
        question(2, { state: 'closed', state_reason: 'completed', comments: ['Thanks.'] }),
        question(3, { state: 'closed', state_reason: 'duplicate', duplicateOf: 1 }),
        { number: 4, title: 'Not a question', labels: ['area:memory'] },
      ],
      milestones: [{ number: 1, ...FADING }],
    });
    expect(pull(github, cache)).toBe('Wrote 3 question(s) and 1 milestone(s) to .questions/');
    const questions = loadQuestions(cache);
    expect(questions.all().map((q) => [q.number, q.status])).toEqual([
      [1, 'open'],
      [2, 'decided'],
      [3, 'duplicate'],
    ]);
    expect(questions.get(1)?.blockedBy).toEqual([2]);
    expect(questions.get(3)?.duplicateOf).toBe(1);
    const constellations = loadConstellations(cache, questions);
    expect(constellations.open().map((c) => [c.name.zh, c.questions.map((q) => q.number)])).toEqual(
      [['褪色的记忆', [1]]],
    );
    expect(github.writes).toEqual([]);
  });
});
