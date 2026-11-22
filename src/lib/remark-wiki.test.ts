import { describe, expect, test } from 'bun:test';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { Locale } from '../i18n/ui';
import type { Question, Questions } from './questions';
import remarkWiki from './remark-wiki';
import { extractCallouts } from './wiki';

const QUESTIONS: Question[] = [
  {
    number: 142,
    url: 'https://github.com/TAGC/oneiros/issues/142',
    kind: 'open',
    area: 'Memory',
    state: 'open',
    status: 'open',
    title: { en: 'Does vividness fade?', zh: '鲜明度会消退吗' },
    text: { en: 'Does [[vividness]] fade overnight?', zh: '[[鲜明度]]会在一夜间消退吗？' },
    properties: {},
    blockedBy: [],
    underminedBy: [],
  },
  {
    number: 7,
    url: 'https://github.com/TAGC/oneiros/issues/7',
    kind: 'conflict',
    state: 'open',
    status: 'open',
    title: { en: 'Two sources disagree' },
    text: { en: 'The vision says X.' },
    properties: {},
    blockedBy: [],
    underminedBy: [],
  },
];

const questions: Questions = {
  all: () => QUESTIONS,
  get: (n) => QUESTIONS.find((q) => q.number === n),
};

function render(markdown: string, locale: Locale): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkWiki, { article: true, locale, questions })
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

describe('issue markers', () => {
  test('render the question in English with its wiki links resolved', () => {
    const html = render('> [!ISSUE 142]', 'en');
    expect(html).toContain('class="note note-open" id="issue-142"');
    expect(html).toContain('<strong>Open question</strong>');
    expect(html).toContain('href="/oneiros/wiki/vividness/"');
    expect(html).toContain('fade overnight?');
    expect(html).not.toContain('[!ISSUE');
  });

  test('render the Chinese text on a Chinese page, linking Chinese pages', () => {
    const html = render('> [!ISSUE 142]', 'zh');
    expect(html).toContain('<strong>待定问题</strong>');
    expect(html).toContain('href="/oneiros/zh/wiki/vividness/"');
    expect(html).toContain('会在一夜间消退吗？');
    expect(html).not.toContain('fade overnight');
  });

  test('take the box header from the kind label', () => {
    const html = render('> [!ISSUE 7]', 'en');
    expect(html).toContain('class="note note-conflict" id="issue-7"');
    expect(html).toContain('<strong>Conflict: vision and sheet disagree</strong>');
  });

  test('a missing question still renders a box that says so', () => {
    const html = render('> [!ISSUE 999]', 'en');
    expect(html).toContain('id="issue-999"');
    expect(html).toContain('#999');
  });

  test('sit alongside inline callouts', () => {
    const html = render('> [!OPEN]\n> Inline text.\n\n> [!ISSUE 7]\n\n> [!OPEN]\n> More.', 'en');
    expect(html).toContain('id="open-1"');
    expect(html).toContain('id="open-2"');
    expect(html).toContain('id="issue-7"');
    expect(html).toContain('Inline text.');
  });
});

describe('callouts on a page', () => {
  const body = '> [!OPEN]\n> Inline text.\n\n> [!ISSUE 142]\n\n> [!ISSUE 7]\n';

  test('list inline callouts and marker questions in page order', () => {
    expect(extractCallouts(body, 'en', questions)).toEqual([
      { kind: 'open', id: 'open-1', markdown: 'Inline text.' },
      { kind: 'open', id: 'issue-142', markdown: 'Does [[vividness]] fade overnight?', issue: 142 },
      { kind: 'conflict', id: 'issue-7', markdown: 'The vision says X.', issue: 7 },
    ]);
  });

  test('take marker text in the page locale', () => {
    expect(extractCallouts(body, 'zh', questions)[1].markdown).toBe('[[鲜明度]]会在一夜间消退吗？');
  });
});
