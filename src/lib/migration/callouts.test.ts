import { describe, expect, test } from 'bun:test';
import {
  buildIssue,
  conflictSources,
  findCallouts,
  LABELS,
  migrationKey,
  pairPage,
  replaceWithMarker,
} from './callouts';

const EN = `---
title: Ablaze
area: Emotion
---

Intro.

> [!OPEN]
> Does it burn out?

## While Ablaze

Text.

> [!CONFLICT]
> The sheet says one thing.
>
> The vision says [[Fire|another]].

### Sub _heading_ [[Hold]]

> [!ISSUE 12]
`;

describe('findCallouts', () => {
  test('lists callouts and markers in page order with their text and section', () => {
    const items = findCallouts(EN);
    expect(items.map(({ start: _s, end: _e, ...rest }) => rest)).toEqual([
      { type: 'callout', kind: 'open', text: 'Does it burn out?' },
      {
        type: 'callout',
        kind: 'conflict',
        text: 'The sheet says one thing.\n\nThe vision says [[Fire|another]].',
        section: 'While Ablaze',
      },
      { type: 'marker', issue: 12, section: 'Sub heading Hold' },
    ]);
  });

  test('gives each item its source range in the raw file', () => {
    const [first] = findCallouts(EN);
    expect(EN.slice(first.start, first.end)).toBe('> [!OPEN]\n> Does it burn out?');
  });
});

const page = (...quotes: string[]) => `---\ntitle: T\n---\n\n${quotes.join('\n\n')}\n`;
const OPEN = (text: string) => `> [!OPEN]\n> ${text}`;
const CONFLICT = (text: string) => `> [!CONFLICT]\n> ${text}`;

describe('pairPage', () => {
  test('pairs English and Chinese callouts by order, numbered from 1', () => {
    const result = pairPage(
      'ablaze',
      page(OPEN('One?'), CONFLICT('Two.')),
      page(OPEN('一？'), CONFLICT('二。')),
    );
    expect(result.problems).toEqual([]);
    expect(result.pairs.map((p) => [p.index, p.en.type, p.zh.type])).toEqual([
      [1, 'callout', 'callout'],
      [2, 'callout', 'callout'],
    ]);
    expect(result.pairs[1].zh).toMatchObject({ kind: 'conflict', text: '二。' });
  });

  test('reports a page whose callout counts differ and pairs nothing', () => {
    const result = pairPage('ablaze', page(OPEN('One?'), OPEN('Two?')), page(OPEN('一？')));
    expect(result.pairs).toEqual([]);
    expect(result.problems).toEqual(['ablaze: English has 2 callouts or markers, Chinese has 1']);
  });

  test('reports callouts whose kinds differ and pairs nothing', () => {
    const result = pairPage(
      'ablaze',
      page(OPEN('One?'), OPEN('Two?')),
      page(OPEN('一？'), CONFLICT('二。')),
    );
    expect(result.pairs).toEqual([]);
    expect(result.problems).toEqual([
      'ablaze: callout 2 is open in English but conflict in Chinese',
    ]);
  });

  test('keeps a half-migrated pair, where only one side is a marker', () => {
    const result = pairPage(
      'ablaze',
      page('> [!ISSUE 7]', OPEN('Two?')),
      page(OPEN('一？'), OPEN('二？')),
    );
    expect(result.problems).toEqual([]);
    expect(result.pairs.map((p) => [p.en.type, p.zh.type])).toEqual([
      ['marker', 'callout'],
      ['callout', 'callout'],
    ]);
  });

  test('reports markers naming different issues in the two languages', () => {
    const result = pairPage('ablaze', page('> [!ISSUE 7]'), page('> [!ISSUE 8]'));
    expect(result.problems).toEqual([
      'ablaze: item 1 is issue 7 in English but issue 8 in Chinese',
    ]);
  });

  test('reports a page missing in one language when it holds callouts', () => {
    expect(pairPage('ablaze', page(OPEN('One?')), undefined).problems).toEqual([
      'ablaze: no Chinese page, English has 1 callouts or markers',
    ]);
    expect(pairPage('ablaze', page('Plain.'), undefined)).toEqual({ pairs: [], problems: [] });
  });
});

describe('conflictSources', () => {
  test('names the sources in the order the text first mentions them', () => {
    expect(conflictSources('The vision says X. The sheet said Y.')).toEqual(['vision', 'sheet']);
    expect(conflictSources("The sheet's row said Y. The vision says X.")).toEqual([
      'sheet',
      'vision',
    ]);
  });

  test('reads the Glossary as the sheet, whose Glossary tab it was', () => {
    expect(conflictSources('The Glossary calls it Y. The vision says X.')).toEqual([
      'sheet',
      'vision',
    ]);
    expect(conflictSources('The vision says X. The Glossary says Y. The sheet too.')).toEqual([
      'vision',
      'sheet',
    ]);
  });

  test('finds nothing in text naming neither', () => {
    expect(conflictSources("Humility's cell said X.")).toEqual([]);
  });
});

describe('buildIssue', () => {
  const base = {
    slug: 'ablaze',
    pageTitle: 'Ablaze',
    area: 'Emotion',
    index: 2,
    title: { en: 'Does Ablaze burn out?', zh: '炽燃会燃尽吗？' },
    text: { en: 'Does it [[burn]] out?', zh: '它会[[燃烧|燃]]尽吗？' },
  };

  test('builds an open question with its labels, property table and both languages', () => {
    const issue = buildIssue({ ...base, kind: 'open', section: 'While Ablaze' });
    expect(issue.title).toBe('Does Ablaze burn out?');
    expect(issue.labels).toEqual(['kind:open', 'area:emotion']);
    expect(issue.body).toBe(
      [
        '<!-- migrated-callout: ablaze#2 -->',
        '',
        '| Property | Value |',
        '|---|---|',
        '| Page | [Ablaze](https://tagc.github.io/oneiros/wiki/ablaze/) |',
        '| Section | While Ablaze |',
        '',
        '## en',
        '',
        'Does it [[burn]] out?',
        '',
        '## zh',
        '',
        '### 炽燃会燃尽吗？',
        '',
        '它会[[燃烧|燃]]尽吗？',
        '',
      ].join('\n'),
    );
  });

  test('gives a conflict its Source row and a Raised row when known, escaping pipes', () => {
    const issue = buildIssue({
      ...base,
      kind: 'conflict',
      section: 'A | B',
      sources: ['sheet', 'vision'],
      raised: '21 Nov 2026, [abc1234](https://github.com/TAGC/oneiros/commit/abc1234)',
    });
    expect(issue.labels).toEqual(['kind:conflict', 'area:emotion']);
    expect(issue.body).toContain(
      [
        '| Section | A \\| B |',
        '| Source | sheet, vision |',
        '| Raised | 21 Nov 2026, [abc1234](https://github.com/TAGC/oneiros/commit/abc1234) |',
        '',
      ].join('\n'),
    );
  });

  test('leaves out the Section row for a callout above every heading', () => {
    expect(buildIssue({ ...base, kind: 'open' }).body).not.toContain('| Section |');
  });

  test('carries a hidden key that finds the issue again', () => {
    const { body } = buildIssue({ ...base, kind: 'open' });
    expect(migrationKey(body)).toBe('ablaze#2');
    expect(migrationKey('No key here.')).toBeUndefined();
  });

  test('rejects an area the wiki does not define', () => {
    expect(() => buildIssue({ ...base, kind: 'open', area: 'Weather' })).toThrow('Weather');
  });
});

describe('replaceWithMarker', () => {
  test('swaps a callout for its marker and leaves the rest of the page alone', () => {
    const raw = page(OPEN('One?'), CONFLICT('Two.\n>\n> More.'), OPEN('Three?'));
    const [, second] = findCallouts(raw);
    const out = replaceWithMarker(raw, second, 42);
    expect(out).toBe(page(OPEN('One?'), '> [!ISSUE 42]', OPEN('Three?')));
    expect(findCallouts(out).map((i) => i.type)).toEqual(['callout', 'marker', 'callout']);
  });
});

describe('LABELS', () => {
  test('holds the two kind labels and one label per area, each with a colour', () => {
    const names = LABELS.map((l) => l.name);
    expect(names.slice(0, 2)).toEqual(['kind:open', 'kind:conflict']);
    expect(names).toContain('area:memory');
    expect(names).toContain('area:temenos');
    expect(names.length).toBe(18);
    for (const label of LABELS) expect(label.color).toMatch(/^[0-9a-f]{6}$/);
  });
});
