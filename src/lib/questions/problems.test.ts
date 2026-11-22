import { describe, expect, test } from 'bun:test';
import type { Question, Questions } from '.';
import { issueProblems, type MarkedPage, markerProblems } from './problems';

function question(fields: Partial<Question> & { number: number }): Question {
  return {
    url: `https://github.com/TAGC/oneiros/issues/${fields.number}`,
    kind: 'open',
    state: 'open',
    status: 'open',
    title: { en: 'A question', zh: '一个问题' },
    text: { en: 'English.', zh: '中文。' },
    properties: { page: 'ablaze' },
    blockedBy: [],
    underminedBy: [],
    ...fields,
  };
}

function questions(...list: Question[]): Questions {
  return { all: () => list, get: (n) => list.find((q) => q.number === n) };
}

function page(locale: 'en' | 'zh', issues: number[], fields: Partial<MarkedPage> = {}): MarkedPage {
  const dir = locale === 'en' ? 'src/content/wiki' : 'src/content/wiki-zh';
  return {
    file: `${dir}/ablaze.md`,
    locale,
    slug: 'ablaze',
    markers: issues.map((issue, i) => ({ issue, line: 10 + i })),
    ...fields,
  };
}

const messages = (problems: { where: string; message: string }[]) =>
  problems.map((p) => `${p.where}: ${p.message}`);

describe('marker checks', () => {
  test('a sound pair of pages passes', () => {
    const qs = questions(question({ number: 1 }), question({ number: 2 }));
    expect(markerProblems(qs, [page('en', [1, 2]), page('zh', [1, 2])])).toEqual([]);
  });

  test('a marker naming a missing or closed issue fails', () => {
    const qs = questions(question({ number: 2, state: 'closed', status: 'decided' }));
    expect(messages(markerProblems(qs, [page('en', [1, 2]), page('zh', [1, 2])]))).toEqual([
      expect.stringContaining('src/content/wiki/ablaze.md:10: marker names #1, which is not'),
      expect.stringContaining('src/content/wiki/ablaze.md:11: marker names #2, which is closed'),
      expect.stringContaining('src/content/wiki-zh/ablaze.md:10: marker names #1'),
      expect.stringContaining('src/content/wiki-zh/ablaze.md:11: marker names #2'),
    ]);
  });

  test('a marker question without a Page row fails', () => {
    const qs = questions(question({ number: 1, properties: {} }));
    expect(messages(markerProblems(qs, [page('en', [1]), page('zh', [1])]))).toEqual([
      'src/content/wiki/ablaze.md:10: #1 has no Page row; it should link to this page',
    ]);
  });

  test('a Page row naming another page fails', () => {
    const qs = questions(question({ number: 1, properties: { page: 'vividness' } }));
    expect(messages(markerProblems(qs, [page('en', [1]), page('zh', [1])]))).toEqual([
      'src/content/wiki/ablaze.md:10: #1 has Page vividness, but its marker is on ablaze',
    ]);
  });

  test('English and Chinese pages with different markers fail', () => {
    const qs = questions(question({ number: 1 }), question({ number: 2 }));
    expect(messages(markerProblems(qs, [page('en', [1, 2]), page('zh', [2])]))).toEqual([
      'src/content/wiki-zh/ablaze.md: markers #2, English has #1, #2',
    ]);
  });

  test('a Certainty or Dogma page holding a marker fails', () => {
    const qs = questions(question({ number: 1 }));
    const pages = [page('en', [1], { status: 'Dogma' }), page('zh', [1], { status: 'Dogma' })];
    expect(messages(markerProblems(qs, pages))).toEqual([
      'src/content/wiki/ablaze.md:10: Dogma page holds question #1; resolve it or lower the status',
      'src/content/wiki-zh/ablaze.md:10: Dogma page holds question #1; resolve it or lower the status',
    ]);
  });
});

describe('issue checks', () => {
  test('a sound issue passes', () => {
    const answered = question({
      number: 1,
      state: 'closed',
      status: 'decided',
      answer: { en: 'Yes.', zh: '是。' },
      blockedBy: [2],
    });
    expect(issueProblems(questions(answered, question({ number: 2 })))).toEqual([]);
  });

  test('a missing locale section or Chinese title fails', () => {
    const qs = questions(
      question({ number: 1, text: { en: 'English.' }, title: { en: 'A question' } }),
      question({ number: 2, title: { en: 'A question' } }),
    );
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(/issues\/1: no `## zh` section$/),
      expect.stringMatching(/issues\/2: the `## zh` section has no `### ` title line$/),
    ]);
  });

  test('an answer comment missing a locale section fails', () => {
    const qs = questions(question({ number: 1, answer: { en: 'Yes.' } }));
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(/issues\/1: the answer comment has no `### zh` section$/),
    ]);
  });

  test('Undermined by or blocked-by naming a missing issue fails', () => {
    const qs = questions(question({ number: 1, underminedBy: [8], blockedBy: [9] }));
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(/issues\/1: blocked by #9, which is not a question issue/),
      expect.stringMatching(/issues\/1: Undermined by names #8, which is not a question issue/),
    ]);
  });

  test('a conflict source that is neither a page nor a listed source fails', () => {
    const sources = ['vision', '[[Ablaze]]', 'the forum', '[[No such page]]'];
    const qs = questions(question({ number: 1, kind: 'conflict', properties: { sources } }));
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(/issues\/1: Source "the forum" is neither a wiki link nor one of/),
      expect.stringMatching(/issues\/1: Source "\[\[No such page\]\]" links to no page in en, zh$/),
    ]);
  });
});
