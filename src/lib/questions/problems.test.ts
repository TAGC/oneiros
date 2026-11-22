import { describe, expect, test } from 'bun:test';
import type { Question, Questions } from '.';
import { cycleProblems, issueProblems, type MarkedPage, markerProblems } from './problems';

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

  test('an inline open or conflict callout fails in either language', () => {
    const callouts = [
      { kind: 'open' as const, line: 4 },
      { kind: 'conflict' as const, line: 8 },
    ];
    const pages = [page('en', [], { callouts }), page('zh', [], { callouts: callouts.slice(1) })];
    expect(messages(markerProblems(questions(), pages))).toEqual([
      'src/content/wiki/ablaze.md:4: inline [!OPEN] callout; make it a question issue and put a `> [!ISSUE N]` marker here',
      'src/content/wiki/ablaze.md:8: inline [!CONFLICT] callout; make it a question issue and put a `> [!ISSUE N]` marker here',
      'src/content/wiki-zh/ablaze.md:8: inline [!CONFLICT] callout; make it a question issue and put a `> [!ISSUE N]` marker here',
    ]);
  });

  test('another spelling of a marker fails and shows the right one', () => {
    const misspelt = [
      { found: '> [!issue #12]', issue: 12, line: 4 },
      { found: '> [!Issue]', line: 8 },
    ];
    expect(messages(markerProblems(questions(), [page('en', [], { misspelt })]))).toEqual([
      'src/content/wiki/ablaze.md:4: `> [!issue #12]` is not a marker; write `> [!ISSUE 12]`, alone in a quote of its own',
      'src/content/wiki/ablaze.md:8: `> [!Issue]` is not a marker; write `> [!ISSUE N]`, alone in a quote of its own',
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

  test('a closed issue with no answer comment fails', () => {
    const qs = questions(
      question({ number: 1, state: 'closed', status: 'decided' }),
      question({
        number: 2,
        state: 'closed',
        status: 'ruled-out',
        closeReason: 'not_planned',
      }),
      question({
        number: 3,
        state: 'closed',
        status: 'decided',
        answer: { en: 'Y.', zh: '是。' },
      }),
      question({ number: 4 }),
    );
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(/issues\/1: closed with no answer comment$/),
      expect.stringMatching(/issues\/2: closed with no answer comment$/),
    ]);
  });

  test('a missing locale section or Chinese title fails', () => {
    const qs = questions(
      question({
        number: 1,
        text: { en: 'English.' },
        title: { en: 'A question' },
      }),
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
      expect.stringMatching(/issues\/1: blocked by #9, which is not a question/),
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

  test('a blocked-by link to a non-question issue says it is not a question', () => {
    const qs = questions(question({ number: 1, blockedBy: [9] }));
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(
        /issues\/1: blocked by #9, which is not a question \(no `kind:open` or `kind:conflict` label\)$/,
      ),
    ]);
  });

  test('a conflict naming fewer than two sources fails', () => {
    const one = { sources: ['vision'] };
    const qs = questions(
      question({ number: 1, kind: 'conflict', properties: {} }),
      question({ number: 2, kind: 'conflict', properties: one }),
      question({
        number: 3,
        kind: 'conflict',
        properties: { sources: ['vision', 'sheet'] },
      }),
      question({ number: 4, kind: 'open', properties: one }),
    );
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(
        /issues\/1: a conflict needs at least two sources; the Source row names 0$/,
      ),
      expect.stringMatching(
        /issues\/2: a conflict needs at least two sources; the Source row names 1$/,
      ),
    ]);
  });
});

describe('duplicate checks', () => {
  const duplicate = (number: number, duplicateOf?: number) =>
    question({
      number,
      state: 'closed',
      status: 'duplicate',
      closeReason: 'duplicate',
      ...(duplicateOf !== undefined && { duplicateOf }),
    });

  test('a marker naming a duplicate names the canonical issue and its page', () => {
    const canonical = question({ number: 3, properties: { page: 'vividness' } });
    const qs = questions(canonical, duplicate(5, 3));
    const fix = 'replace the marker with one line linking to #3 there';
    expect(messages(markerProblems(qs, [page('en', [5]), page('zh', [5])]))).toEqual([
      `src/content/wiki/ablaze.md:10: marker names #5, a duplicate of #3 on vividness; ${fix}`,
      `src/content/wiki-zh/ablaze.md:10: marker names #5, a duplicate of #3 on vividness; ${fix}`,
    ]);
  });

  test('a marker naming a duplicate of an issue with no Page row says so', () => {
    const qs = questions(question({ number: 3, properties: {} }), duplicate(5, 3));
    expect(messages(markerProblems(qs, [page('en', [5]), page('zh', [5])]))[0]).toBe(
      'src/content/wiki/ablaze.md:10: marker names #5, a duplicate of #3, which has no Page row; replace the marker with one line linking to #3 on its page',
    );
  });

  test('a sound duplicate passes without an answer comment', () => {
    expect(issueProblems(questions(question({ number: 3 }), duplicate(5, 3)))).toEqual([]);
  });

  test('a duplicate of a duplicate, of a missing issue or of no issue fails', () => {
    const qs = questions(
      question({ number: 3 }),
      duplicate(4, 3),
      duplicate(5, 4),
      duplicate(6, 9),
      duplicate(7),
    );
    expect(messages(issueProblems(qs))).toEqual([
      expect.stringMatching(
        /issues\/5: a duplicate of #4, which is itself a duplicate of #3; mark #5 a duplicate of #3$/,
      ),
      expect.stringMatching(
        /issues\/6: a duplicate of #9, which is not a question issue in \.questions\/ \(missing, or no `kind:` label\)$/,
      ),
      expect.stringMatching(
        /issues\/7: closed as a duplicate, but GitHub names no canonical issue in this repo/,
      ),
    ]);
  });
});

describe('cycle checks', () => {
  test('each blocked-by cycle fails once, naming its questions', () => {
    const qs = questions(
      question({ number: 1, blockedBy: [2] }),
      question({ number: 2, blockedBy: [1] }),
      question({ number: 3, blockedBy: [1] }),
      question({ number: 4, blockedBy: [4] }),
    );
    expect(messages(cycleProblems(qs))).toEqual([
      expect.stringMatching(
        /issues\/1: blocked-by cycle through #1, #2; remove one of its blocked-by links$/,
      ),
      expect.stringMatching(
        /issues\/4: blocked-by cycle through #4; remove one of its blocked-by links$/,
      ),
    ]);
  });

  test('questions without a cycle pass', () => {
    const qs = questions(question({ number: 1 }), question({ number: 2, blockedBy: [1] }));
    expect(cycleProblems(qs)).toEqual([]);
  });
});
