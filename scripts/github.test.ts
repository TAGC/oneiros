import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { loadQuestions } from '../src/lib/questions';
import { currentChart } from '../src/lib/questions/constellation-plan';
import { writeConstellation } from '../src/lib/questions/constellation-format';
import { loadConstellations } from '../src/lib/questions/constellations';
import { type FakeIssue, fakeGitHub } from './github-fake';
import { applyChart } from './constellations';
import { pull } from './pull';
import { applyLinks } from './question-links';

let dir: string;
let cache: string;
let out: string[];
const log = (line: string) => out.push(line);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oneiros-github-'));
  cache = join(dir, '.questions');
  out = [];
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

describe('a links plan', () => {
  const PLAN = `Some notes.

\`\`\`question-links
add #2 blocked-by #1: #2 asks how fast it fades.
add #2 related #3: both on Memory.
remove #3 blocked-by #1: #3 does not depend on #1.
add #4 undermined-by #2: #2 broke its premise.
\`\`\`
`;

  const seed = () =>
    fakeGitHub({
      issues: [
        question(1),
        question(2, { body: body({ Raised: '22 Nov 2026', Related: '#1' }) }),
        question(3, { blockedBy: [1] }),
        question(4, { state: 'closed', state_reason: 'completed', comments: ['## Answer'] }),
      ],
    });

  test('a dry run prints the changes and writes nothing', () => {
    const github = seed();
    applyLinks(github, PLAN, { live: false, cache, log });
    expect(github.writes).toEqual([]);
    expect(out).toContain('#2: would add blocked by #1');
    expect(out).toContain('#3: would remove blocked by #1');
    expect(out).toContain('  + | Related | #1, #3 |');
    expect(out.at(-1)).toBe('Dry run: 5 change(s). Add --live to make them.');
  });

  test('a live run leaves GitHub holding the plan and refreshes the cache', () => {
    const github = seed();
    applyLinks(github, PLAN, { live: true, cache, log });
    expect(github.question(2).blockedBy).toEqual([{ number: 1 }]);
    expect(github.question(3).blockedBy).toEqual([]);
    expect(github.question(2).body).toContain('| Related | #1, #3 |');
    expect(github.question(3).body).toContain('| Related | #2 |');
    expect(github.question(4).body).toContain('| Undermined by | #2 |');
    expect(github.question(1).body).toBe(body({ Raised: '22 Nov 2026' }));

    const questions = loadQuestions(cache);
    expect(questions.get(2)?.blockedBy).toEqual([1]);
    expect(questions.get(4)?.status).toBe('undermined');
    expect(out.slice(-2)).toEqual([
      'Made 5 change(s).',
      'Wrote 4 question(s) and 0 milestone(s) to .questions/',
    ]);
  });

  test('running it again changes nothing', () => {
    const github = seed();
    applyLinks(github, PLAN, { live: true, cache, log });
    const before = github.writes.length;
    out = [];
    applyLinks(github, PLAN, { live: true, cache, log });
    expect(github.writes.length).toBe(before);
    expect(out).toContain('skipped: #2 is already blocked by #1');
    expect(out).toContain('skipped: #3 is not blocked by #1');
  });

  test('a plan naming an issue that is not a question fails before any write', () => {
    const github = fakeGitHub({
      issues: [question(1), { number: 9, title: 'A bug', labels: ['bug'] }],
    });
    expect(() => applyLinks(github, 'add #1 related #9', { live: true, cache, log })).toThrow(
      '#9 is not a question issue',
    );
    expect(github.writes).toEqual([]);
  });
});

describe('a constellations plan', () => {
  const OLD = writeConstellation({
    name: { en: 'Old group', zh: '旧组' },
    reasoning: { en: 'An old theme.', zh: '旧主题。' },
    size: 'small',
    energy: 'low',
  });
  const PLAN = `constellations:
  - number: 1
    name:
      en: Fading memories
      zh: 褪色的记忆
    size: small
    energy: low
    reasoning:
      en: How memories fade and what it costs.
      zh: 记忆如何褪色以及代价为何。
    questions: [1, 3]
  - name:
      en: Beads and obols
      zh: 珠子与奥波
    size: small
    energy: medium
    reasoning:
      en: What a bead holds.
      zh: 珠子承载什么。
    questions: [2, 4]
`;

  function seed() {
    const github = fakeGitHub({
      issues: [
        question(1, { milestone: 1 }),
        question(2, { milestone: 1 }),
        question(3),
        question(4),
        question(5, { milestone: 2, state: 'closed', state_reason: 'completed' }),
      ],
      milestones: [
        { number: 1, ...FADING },
        { number: 2, ...OLD },
        { number: 3, title: 'Release 1', description: 'Not a constellation.' },
      ],
    });
    pull(github, cache);
    return github;
  }

  test('a dry run prints the operations and writes nothing', () => {
    const github = seed();
    expect(applyChart(github, PLAN, { live: false, cache, log })).toBe(true);
    expect(github.writes).toEqual([]);
    expect(out).toEqual([
      'edit milestone 1: description',
      'create milestone "✦ Beads and obols"',
      'assign #2 to milestone "Beads and obols"',
      'assign #3 to milestone 1',
      'assign #4 to milestone "Beads and obols"',
      'close milestone 2',
      'Dry run: 6 change(s). Add --live to make them.',
    ]);
  });

  test('a live run leaves GitHub holding the plan and refreshes the cache', () => {
    const github = seed();
    expect(applyChart(github, PLAN, { live: true, cache, log })).toBe(true);
    const milestones = github.milestones();
    expect(milestones.map((m) => [m.number, m.title, m.state])).toEqual([
      [1, '✦ Fading memories', 'open'],
      [2, '✦ Old group', 'closed'],
      [3, 'Release 1', 'open'],
      [4, '✦ Beads and obols', 'open'],
    ]);
    expect(milestones[0].description).toContain('How memories fade and what it costs.');
    expect(milestones[2].description).toBe('Not a constellation.');
    expect(milestones[3].description).toContain('### 珠子与奥波');
    expect(out.slice(-2)).toEqual([
      'Made 6 change(s).',
      'Wrote 5 question(s) and 4 milestone(s) to .questions/',
    ]);
    expect(github.questions().map((q) => [q.number, q.milestone?.number])).toEqual([
      [1, 1],
      [2, 4],
      [3, 1],
      [4, 4],
      [5, 2],
    ]);

    const constellations = loadConstellations(cache, loadQuestions(cache));
    expect(constellations.open().map((c) => [c.name.en, c.questions.map((q) => q.number)])).toEqual(
      [
        ['Fading memories', [1, 3]],
        ['Beads and obols', [2, 4]],
      ],
    );
    expect(constellations.ungrouped()).toEqual([]);
  });

  test('applying the chart it leaves says nothing to change', () => {
    const github = seed();
    applyChart(github, PLAN, { live: true, cache, log });
    const before = github.writes.length;
    out = [];
    const chart = stringifyYaml(currentChart(loadConstellations(cache, loadQuestions(cache))));
    expect(applyChart(github, chart, { live: true, cache, log })).toBe(true);
    expect(github.writes.length).toBe(before);
    expect(out).toEqual([
      'Nothing to change.',
      'Wrote 5 question(s) and 4 milestone(s) to .questions/',
    ]);
  });

  test('a plan with errors writes nothing', () => {
    const github = seed();
    const missing = PLAN.replace('questions: [2, 4]', 'questions: [2]');
    expect(applyChart(github, missing, { live: true, cache, log })).toBe(false);
    expect(out).toContain('error: #4 is open but in no planned constellation');
    expect(github.writes).toEqual([]);
  });
});
