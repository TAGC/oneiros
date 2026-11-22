import { describe, expect, test } from 'bun:test';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { Locale } from '../i18n/locale';
import type { Question, Questions } from './questions';
import remarkWiki from './remark-wiki';
import { markerBox } from './wiki';

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
    properties: { sources: ['Vision', 'sheet'] },
    blockedBy: [],
    underminedBy: [],
  },
  conflict(8, ['[[Ablaze]]', 'vision', 'Sheet']),
  conflict(9),
];

function conflict(number: number, sources?: string[]): Question {
  return {
    number,
    url: `https://github.com/TAGC/oneiros/issues/${number}`,
    kind: 'conflict',
    state: 'open',
    status: 'open',
    title: { en: `Conflict ${number}`, zh: `冲突 ${number}` },
    text: { en: 'English text.', zh: '中文。' },
    properties: sources ? { sources } : {},
    blockedBy: [],
    underminedBy: [],
  };
}

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

  test('a conflict names two sources from its Source row', () => {
    expect(render('> [!ISSUE 7]', 'en')).toContain(
      '<strong>Conflict: vision and sheet disagree</strong>',
    );
    expect(render('> [!ISSUE 7]', 'zh')).toContain('<strong>冲突：愿景与参考表不一致</strong>');
  });

  test('a conflict names three sources, wiki links by their page title', () => {
    expect(render('> [!ISSUE 8]', 'en')).toContain(
      '<strong>Conflict: Ablaze, vision and sheet disagree</strong>',
    );
    expect(render('> [!ISSUE 8]', 'zh')).toContain(
      '<strong>冲突：燃烧中、愿景与参考表不一致</strong>',
    );
  });

  test('a conflict without a Source row is just a conflict', () => {
    expect(render('> [!ISSUE 9]', 'en')).toContain('<strong>Conflict</strong>');
    expect(render('> [!ISSUE 9]', 'zh')).toContain('<strong>冲突</strong>');
  });

  test('a missing question still renders a box that says so', () => {
    const html = render('> [!ISSUE 999]', 'en');
    expect(html).toContain('id="issue-999"');
    expect(html).toContain('#999');
  });

  test('mark English text on a Chinese page as English', () => {
    const html = render('> [!ISSUE 7]', 'zh');
    expect(html).toContain('<p lang="en">The vision says X.</p>');
    expect(html).not.toMatch(/class="note-h"[^>]*lang=/);
  });

  test('leave text in the page language unmarked', () => {
    expect(render('> [!ISSUE 142]', 'zh')).not.toContain('lang=');
  });

  test('are the only boxes: an old inline callout stays a plain quote', () => {
    const html = render('> [!OPEN]\n> Inline text.\n\n> [!ISSUE 7]', 'en');
    expect(html).toContain('id="issue-7"');
    expect(html).not.toContain('id="open-1"');
    expect(html).toContain('<blockquote>');
  });

  test('count only in a quote of their own: a nested or misspelt marker stays a quote', () => {
    const html = render('> Quoted.\n>\n> > [!ISSUE 7]\n\n> [!issue #142]', 'en');
    expect(html).not.toContain('class="note');
    expect(html).toContain('[!ISSUE 7]');
  });
});

describe('a marker box', () => {
  test('takes its kind, anchor and text from the question', () => {
    expect(markerBox(7, 'en', questions)).toEqual({
      kind: 'conflict',
      id: 'issue-7',
      markdown: 'The vision says X.',
      lang: 'en',
      issue: 7,
    });
  });

  test('falls back to English text, saying so', () => {
    expect(markerBox(7, 'zh', questions)).toMatchObject({
      markdown: 'The vision says X.',
      lang: 'en',
    });
  });

  test('takes its text in the page locale', () => {
    expect(markerBox(142, 'zh', questions).markdown).toBe('[[鲜明度]]会在一夜间消退吗？');
  });
});
