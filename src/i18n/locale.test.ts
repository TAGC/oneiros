import { describe, expect, test } from 'bun:test';
import { inLocale } from './locale';

describe('a text in a locale', () => {
  test('comes in the page language when it has one', () => {
    expect(inLocale({ en: 'Hold', zh: '持守' }, 'zh')).toEqual({ text: '持守', lang: 'zh' });
  });

  test('falls back to English, saying so', () => {
    expect(inLocale({ en: 'Hold' }, 'zh')).toEqual({ text: 'Hold', lang: 'en' });
  });

  test('is missing when neither language has it', () => {
    expect(inLocale({}, 'zh')).toBeUndefined();
  });
});
