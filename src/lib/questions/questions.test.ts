import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, writeQuestionCache } from '.';

const URL = 'https://github.com/TAGC/oneiros/issues';

function issue(fields: Partial<PulledIssue> & { number: number }): PulledIssue {
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

function roundTrip(issues: PulledIssue[]) {
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
      status: 'open',
      title: { en: 'Does vividness fade?', zh: '鲜明度会在一夜间消退吗' },
      text: {
        en: 'Does [[vividness]] fade overnight?\n\nA second paragraph.',
        zh: '[[鲜明度]]会在一夜间消退吗？',
      },
      properties: {},
      blockedBy: [],
      underminedBy: [],
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

const TABLE = [
  '| Property | Value |',
  '|---|---|',
  '| Page | [Ablaze](https://tagc.github.io/oneiros/wiki/ablaze/) |',
  '| Section | While Ablaze |',
  '| Source | Vision, [[Ablaze]] and sheet |',
  '| Raised | 21 Nov 2026, a chat |',
  '| Related | #139, #145 |',
  '| Undermined by | #208 |',
].join('\n');

const LOCALES_BODY = '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。';

describe('issue properties', () => {
  test('the property table becomes properties and the Undermined by edge', () => {
    const body = `${TABLE}\n\n${LOCALES_BODY}`;
    const q = roundTrip([issue({ number: 1, body })]).get(1);
    expect(q?.properties).toEqual({
      page: 'ablaze',
      section: 'While Ablaze',
      sources: ['Vision', '[[Ablaze]]', 'sheet'],
      raised: '21 Nov 2026, a chat',
      related: [139, 145],
    });
    expect(q?.underminedBy).toEqual([208]);
    expect(q?.text).toEqual({ en: 'English text.', zh: '中文。' });
  });

  test('missing optional rows, or no table at all, are left out', () => {
    const body = `| Property | Value |\n|---|---|\n| Section | Intro |\n\n${LOCALES_BODY}`;
    const questions = roundTrip([issue({ number: 1, body }), issue({ number: 2 })]);
    expect(questions.get(1)?.properties).toEqual({ section: 'Intro' });
    expect(questions.get(2)?.properties).toEqual({});
    expect(questions.get(2)?.underminedBy).toEqual([]);
  });
});

describe('issue context, edges and answer', () => {
  test('the Context section is kept, even with its own table and headings', () => {
    const context =
      'Raised while editing.\n\n| a | b |\n|---|---|\n| x | y |\n\n## Background\n\nMore.';
    const body = `${TABLE}\n\n## Context\n\n${context}\n\n${LOCALES_BODY}`;
    const q = roundTrip([issue({ number: 1, body })]).get(1);
    expect(q?.context).toBe(context);
    expect(q?.properties.section).toBe('While Ablaze');
    expect(q?.text.en).toBe('English text.');
  });

  test('a question without Context has none', () => {
    expect(roundTrip([issue({ number: 1 })]).get(1)?.context).toBeUndefined();
  });

  test('blocked-by links come from GitHub, by number', () => {
    const blockedBy = [issue({ number: 12 }), issue({ number: 4 })];
    const questions = roundTrip([issue({ number: 1, blockedBy }), issue({ number: 2 })]);
    expect(questions.get(1)?.blockedBy).toEqual([4, 12]);
    expect(questions.get(2)?.blockedBy).toEqual([]);
  });

  test('the answer comment gives the answer per locale; other comments are ignored', () => {
    const comments = [
      { body: 'Some discussion.' },
      { body: '## Answer\r\n\r\n### en\r\n\r\nIt fades.\r\n\r\n### zh\r\n\r\n会消退。' },
      { body: 'More discussion after the answer.' },
    ];
    const q = roundTrip([issue({ number: 1, issueComments: comments })]).get(1);
    expect(q?.answer).toEqual({ en: 'It fades.', zh: '会消退。' });
  });

  test("the answer comment's last line is its provenance, not part of an answer", () => {
    const body = [
      '## Answer',
      '',
      '### en',
      '',
      'It fades.',
      '',
      'Slowly.',
      '',
      '### zh',
      '',
      '会消退。',
      '',
      'Decided by the designer, 22 Nov 2026, in a chat. Lands in #210.',
    ].join('\n');
    const q = roundTrip([issue({ number: 1, issueComments: [{ body }] })]).get(1);
    expect(q?.answer).toEqual({ en: 'It fades.\n\nSlowly.', zh: '会消退。' });
    expect(q?.provenance).toBe('Decided by the designer, 22 Nov 2026, in a chat. Lands in #210.');
  });

  test('an answer comment missing a locale keeps the locales it has', () => {
    const comments = [{ body: '## Answer\n\n### en\n\nEnglish only.' }];
    expect(roundTrip([issue({ number: 1, issueComments: comments })]).get(1)?.answer).toEqual({
      en: 'English only.',
    });
  });

  test('no answer comment means no answer', () => {
    const comments = [{ body: 'Thinking about an Answer here.' }, { body: null }];
    expect(
      roundTrip([issue({ number: 1, issueComments: comments })]).get(1)?.answer,
    ).toBeUndefined();
  });
});

describe('derived status', () => {
  const answer = [{ body: '## Answer\n\n### en\n\nSettled.\n\n### zh\n\n已定。' }];
  const undermined = `| Property | Value |\n|---|---|\n| Undermined by | #9 |\n\n${LOCALES_BODY}`;

  test('open, decided, ruled out and undermined', () => {
    const questions = roundTrip([
      issue({ number: 1 }),
      issue({ number: 2, state: 'closed', state_reason: 'completed', issueComments: answer }),
      issue({ number: 3, state: 'closed', state_reason: 'not_planned', issueComments: answer }),
      issue({
        number: 4,
        state: 'closed',
        state_reason: 'completed',
        issueComments: answer,
        body: undermined,
      }),
    ]);
    expect(questions.all().map((q) => q.status)).toEqual([
      'open',
      'decided',
      'ruled-out',
      'undermined',
    ]);
  });

  test('an open question with an Undermined by row is still open', () => {
    expect(roundTrip([issue({ number: 1, body: undermined })]).get(1)?.status).toBe('open');
  });
});
