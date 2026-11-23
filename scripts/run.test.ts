import { describe, expect, test } from 'bun:test';
import { summary } from './run';

describe('the closing line of a run', () => {
  test('says when there is nothing to change, dry or live', () => {
    expect(summary(0, false)).toBe('Nothing to change.');
    expect(summary(0, true)).toBe('Nothing to change.');
  });

  test('a dry run counts the changes and names the flag that makes them', () => {
    expect(summary(3, false)).toBe('Dry run: 3 change(s). Add --live to make them.');
  });

  test('a live run counts the changes made', () => {
    expect(summary(3, true)).toBe('Made 3 change(s).');
  });
});
