import { describe, expect, test } from 'bun:test';
import { readMarkers } from './markers';

describe('markers on a page', () => {
  test('come in page order with their lines', () => {
    const body = 'Intro.\n\n> [!ISSUE 142]\n\nMore.\n\n> [!ISSUE 7]\n';
    expect(readMarkers(body).markers).toEqual([
      { issue: 142, line: 3 },
      { issue: 7, line: 7 },
    ]);
  });

  test('count file lines, past the frontmatter', () => {
    const raw = '---\ntitle: Burning\nkind: term\n---\n\n> [!ISSUE 3]\n';
    expect(readMarkers(raw).markers).toEqual([{ issue: 3, line: 6 }]);
  });

  test('ignore the frontmatter, even text in it that reads like a marker', () => {
    const raw = '---\nsummary: |\n  > [!ISSUE 9]\n---\n\n> [!ISSUE 3]\n';
    expect(readMarkers(raw).markers).toEqual([{ issue: 3, line: 6 }]);
  });

  test('ignore a marker inside a code block', () => {
    const body = '```md\n> [!ISSUE 142]\n```\n\n    > [!ISSUE 7]\n';
    expect(readMarkers(body)).toEqual({ markers: [], callouts: [], misspelt: [] });
  });

  test('ignore a marker in a nested quote, and flag it', () => {
    const body = '> Quoted.\n>\n> > [!ISSUE 142]\n';
    const { markers, misspelt } = readMarkers(body);
    expect(markers).toEqual([]);
    expect(misspelt).toEqual([{ found: '> > [!ISSUE 142]', issue: 142, line: 3 }]);
  });

  test('flag old inline callouts with their lines, not as markers', () => {
    const body = '> [!OPEN]\n> Inline text.\n\n> [!ISSUE 142]\n\n- > [!conflict] In a list.\n';
    expect(readMarkers(`---\ntitle: Burning\n---\n${body}`)).toEqual({
      markers: [{ issue: 142, line: 7 }],
      callouts: [
        { kind: 'open', line: 4 },
        { kind: 'conflict', line: 9 },
      ],
      misspelt: [],
    });
  });

  test('flag every other spelling of a marker, with the issue it seems to name', () => {
    const body = [
      '> [!issue #12]',
      '> [!ISSUE #13]',
      '> [! ISSUE 14]',
      '> [!ISSUE 15] Trailing text.',
      '> [!ISSUE 16]\n> More text.',
      '> [!Issue]',
      '- > [!ISSUE 17]',
    ].join('\n\n');
    expect(readMarkers(body)).toEqual({
      markers: [],
      callouts: [],
      misspelt: [
        { found: '> [!issue #12]', issue: 12, line: 1 },
        { found: '> [!ISSUE #13]', issue: 13, line: 3 },
        { found: '> [! ISSUE 14]', issue: 14, line: 5 },
        { found: '> [!ISSUE 15] Trailing text.', issue: 15, line: 7 },
        { found: '> [!ISSUE 16]', issue: 16, line: 9 },
        { found: '> [!Issue]', line: 12 },
        { found: '- > [!ISSUE 17]', issue: 17, line: 14 },
      ],
    });
  });
});
