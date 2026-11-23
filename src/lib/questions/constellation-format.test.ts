import { describe, expect, test } from 'bun:test';
import {
  type ConstellationText,
  formatProblems,
  readConstellation,
  statedCounts,
  writeConstellation,
} from './constellation-format';

const fading: ConstellationText = {
  name: { en: 'Fading memories', zh: '褪色的记忆' },
  reasoning: { en: 'How memories fade and what that costs.', zh: '记忆如何褪色以及代价为何。' },
  size: 'small',
  energy: 'low',
};

describe('writing a constellation', () => {
  test('follows the docs format', () => {
    expect(writeConstellation({ ...fading, size: 'medium', energy: 'high' })).toEqual({
      title: '✦ Fading memories',
      description: `| Property | Value |
|---|---|
| Size | Medium |
| Energy | High |

## en

How memories fade and what that costs.

## zh

### 褪色的记忆

记忆如何褪色以及代价为何。`,
    });
  });
});

describe('reading a written constellation gives the same constellation', () => {
  const roundTrip = (c: ConstellationText) => readConstellation(writeConstellation(c));

  test('for a plain one', () => {
    expect(roundTrip(fading)).toEqual(fading);
  });

  test('for every size and energy', () => {
    for (const size of ['small', 'medium', 'large']) {
      for (const energy of ['low', 'medium', 'high']) {
        expect(roundTrip({ ...fading, size, energy })).toEqual({ ...fading, size, energy });
      }
    }
  });

  test('for reasoning of several paragraphs, lists and code', () => {
    const reasoning = {
      en: 'How memories fade.\n\n- what fading costs\n- who notices\n\n```md\n## zh\n```',
      zh: '记忆如何褪色。\n\n### 小节\n\n代价为何。',
    };
    expect(roundTrip({ ...fading, reasoning })).toEqual({ ...fading, reasoning });
  });

  test('for names and reasoning written with stray spaces, trimmed', () => {
    const loose = {
      ...fading,
      name: { en: '  Fading memories ', zh: ' 褪色的记忆  ' },
      reasoning: { en: '\nHow memories fade.\n', zh: ' 记忆如何褪色。 ' },
    };
    expect(roundTrip(loose)).toEqual({
      ...fading,
      reasoning: { en: 'How memories fade.', zh: '记忆如何褪色。' },
    });
  });
});

describe('reading a milestone', () => {
  const read = (description: string, title = '✦ Fading memories') =>
    readConstellation({ title, description });

  test('is not a constellation without the mark', () => {
    expect(read(writeConstellation(fading).description, 'Release 1')).toBeUndefined();
  });

  test('ignores case in Size and Energy and keeps values off the scale as written', () => {
    const description = writeConstellation(fading)
      .description.replace('Small', 'SMALL')
      .replace('Low', 'Huge');
    expect(read(description)).toMatchObject({ size: 'small', energy: 'Huge' });
  });

  test('takes a Chinese section with no name line as reasoning only', () => {
    const description = writeConstellation(fading).description.replace('### 褪色的记忆\n\n', '');
    expect(read(description)).toEqual({ ...fading, name: { en: 'Fading memories' } });
  });

  test('reads an empty description as the name alone', () => {
    expect(read('')).toEqual({ name: { en: 'Fading memories' }, reasoning: {} });
  });
});

describe('format problems', () => {
  test('none for a well-formed constellation', () => {
    expect(formatProblems(fading)).toEqual([]);
  });

  test('a missing or off-scale Size or Energy', () => {
    expect(formatProblems({ ...fading, size: undefined, energy: 'none' })).toEqual([
      'no Size; use one of small, medium, large',
      'Energy "none" is not one of low, medium, high',
    ]);
  });

  test('accept Size and Energy in any case', () => {
    expect(formatProblems({ ...fading, size: 'Large', energy: 'HIGH' })).toEqual([]);
  });

  test('a missing name or reasoning in either language', () => {
    expect(formatProblems({ ...fading, name: { en: 'Fading memories' }, reasoning: {} })).toEqual([
      'no Chinese name',
      'no English reasoning',
      'no Chinese reasoning',
    ]);
    expect(formatProblems({ ...fading, name: { en: ' ', zh: '褪色的记忆' } })).toEqual([
      'no English name',
    ]);
  });

  test('none after a round trip of a well-formed constellation', () => {
    expect(formatProblems(readConstellation(writeConstellation(fading))!)).toEqual([]);
  });
});

describe('stated counts in reasoning', () => {
  test('finds counts in English', () => {
    expect(statedCounts('Both ask how memories fade.')).toEqual(['Both']);
    expect(statedCounts('All four turn on one rule, and two are conflicts.')).toEqual([
      'All four',
      'two are',
    ]);
    expect(statedCounts('The 3 questions share a page.')).toEqual(['3 questions']);
  });

  test('finds counts in Chinese', () => {
    expect(statedCounts('两者都问记忆如何褪色。')).toEqual(['两者']);
    expect(statedCounts('这四个问题共用一页，两个是冲突。')).toEqual(['四个', '两个']);
  });

  test('passes reasoning that names the shared theme only', () => {
    expect(statedCounts('How memories fade, by one rule, and what that costs.')).toEqual([]);
    expect(statedCounts('记忆如何按一个规则褪色，十分重要。')).toEqual([]);
  });
});
