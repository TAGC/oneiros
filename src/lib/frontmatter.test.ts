import { describe, expect, test } from 'bun:test';
import { splitFrontmatter } from './frontmatter';

describe('splitFrontmatter', () => {
  test('reads the YAML block and gives the body with the file line it starts on', () => {
    const raw = '---\ntitle: Burning\nkind: term\n---\n\nHow burning works.\n';
    expect(splitFrontmatter(raw)).toEqual({
      data: { title: 'Burning', kind: 'term' },
      body: '\nHow burning works.\n',
      bodyLine: 5,
    });
  });

  test('accepts Windows line endings', () => {
    const raw = '---\r\ntitle: Burning\r\n---\r\nText.';
    expect(splitFrontmatter(raw)).toEqual({
      data: { title: 'Burning' },
      body: 'Text.',
      bodyLine: 4,
    });
  });

  test('a file without frontmatter is all body, from line 1', () => {
    expect(splitFrontmatter('Text.\n')).toEqual({ data: {}, body: 'Text.\n', bodyLine: 1 });
  });

  test('an empty block holds no data', () => {
    expect(splitFrontmatter('---\n\n---\nText.')).toEqual({ data: {}, body: 'Text.', bodyLine: 4 });
  });
});
