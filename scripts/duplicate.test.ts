import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions } from '../src/lib/questions';
import { WIKI_DIRS } from '../src/lib/site';
import { closeDuplicate, duplicatePages } from './duplicate';
import { type FakeIssue, fakeGitHub } from './github-fake';
import { pull } from './pull';

let root: string;
let cache: string;
let out: string[];
const log = (line: string) => out.push(line);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'oneiros-duplicate-'));
  cache = join(root, '.questions');
  out = [];
  page('burning', 'en', 'Burning', 'How burning works.\n\n> [!ISSUE 1]\n');
  page('burning', 'zh', '燃烧', '燃烧如何运作。\n\n> [!ISSUE 1]\n');
  page('ablaze', 'en', 'Ablaze', 'While Ablaze.\n\n> [!ISSUE 2]\n\nMore.\n');
  page('ablaze', 'zh', '燃烧中', '燃烧中时。\n\n> [!ISSUE 2]\n\n更多。\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function page(slug: string, locale: 'en' | 'zh', title: string, body: string): void {
  mkdirSync(join(root, WIKI_DIRS[locale]), { recursive: true });
  writeFileSync(
    join(root, WIKI_DIRS[locale], `${slug}.md`),
    `---\ntitle: ${title}\nkind: term\n---\n\n${body}`,
  );
}
const read = (slug: string, locale: 'en' | 'zh') =>
  readFileSync(join(root, WIKI_DIRS[locale], `${slug}.md`), 'utf8');

/** The ablaze pages once the pull request with the page edits has merged. */
function merged(): void {
  page('ablaze', 'en', 'Ablaze', 'See the open question on [[Burning#issue-1|Burning]].\n');
  page('ablaze', 'zh', '燃烧中', '见[[燃烧#issue-1|燃烧]]上的待定问题。\n');
}

function question(number: number, slug: string, fields: Partial<FakeIssue> = {}): FakeIssue {
  return {
    number,
    title: `Question ${number}`,
    body: `| Property | Value |\n|---|---|\n| Page | [${slug}](https://tagc.github.io/oneiros/wiki/${slug}/) |\n\n## en\n\nText.\n\n## zh\n\n### 标题\n\n文字。`,
    labels: ['kind:open', 'area:magic'],
    ...fields,
  };
}

/** A fake GitHub holding KEEP #1 on Burning and DROP #2 on Ablaze, pulled into the cache. */
function seed(keep: Partial<FakeIssue> = {}, drop: Partial<FakeIssue> = {}) {
  const github = fakeGitHub({
    issues: [question(1, 'burning', keep), question(2, 'ablaze', { milestone: 1, ...drop })],
    milestones: [{ number: 1, title: '✦ Burning', description: '' }],
  });
  pull(github, cache);
  return github;
}

describe('the duplicate command, on the pages', () => {
  test('a dry run prints the page edits and makes none', () => {
    seed();
    expect(duplicatePages(1, 2, { live: false, cache, root, log })).toBe(true);
    expect(read('ablaze', 'en')).toContain('> [!ISSUE 2]');
    expect(out).toEqual([
      'src/content/wiki/ablaze.md:8: would replace the marker for #2 with:',
      '  See the open question on [[Burning#issue-1|Burning]].',
      'src/content/wiki-zh/ablaze.md:8: would replace the marker for #2 with:',
      '  见[[燃烧#issue-1|燃烧]]上的待定问题。',
      'Dry run: 2 change(s). Add --live to make them.',
    ]);
  });

  test('a live run edits both pages and leaves GitHub alone', () => {
    const github = seed();
    expect(duplicatePages(1, 2, { live: true, cache, root, log })).toBe(true);
    expect(read('ablaze', 'en')).toBe(
      '---\ntitle: Ablaze\nkind: term\n---\n\nWhile Ablaze.\n\nSee the open question on [[Burning#issue-1|Burning]].\n\nMore.\n',
    );
    expect(read('ablaze', 'zh')).toBe(
      '---\ntitle: 燃烧中\nkind: term\n---\n\n燃烧中时。\n\n见[[燃烧#issue-1|燃烧]]上的待定问题。\n\n更多。\n',
    );
    expect(read('burning', 'en')).toContain('> [!ISSUE 1]');
    expect(github.writes).toEqual([]);
    expect(github.question(2).state).toBe('open');
    expect(out.at(-1)).toBe(
      'Made 2 change(s). After the pull request merges, run bun run duplicate:close 1 2.',
    );
  });

  test('a conflict is linked as a conflict', () => {
    seed({ labels: ['kind:conflict', 'area:magic'] });
    duplicatePages(1, 2, { live: true, cache, root, log });
    expect(read('ablaze', 'en')).toContain('\nSee the conflict on [[Burning#issue-1|Burning]].\n');
    expect(read('ablaze', 'zh')).toContain('\n见[[燃烧#issue-1|燃烧]]上的冲突。\n');
  });

  test('on the kept question’s own page the marker is removed', () => {
    page('burning', 'en', 'Burning', 'How burning works.\n\n> [!ISSUE 1]\n\n> [!ISSUE 2]\n');
    page('burning', 'zh', '燃烧', '燃烧如何运作。\n\n> [!ISSUE 1]\n\n> [!ISSUE 2]\n');
    seed({}, { body: question(2, 'burning').body });
    duplicatePages(1, 2, { live: true, cache, root, log });
    expect(read('burning', 'en')).toBe(
      '---\ntitle: Burning\nkind: term\n---\n\nHow burning works.\n\n> [!ISSUE 1]\n',
    );
    expect(read('burning', 'zh')).toBe(
      '---\ntitle: 燃烧\nkind: term\n---\n\n燃烧如何运作。\n\n> [!ISSUE 1]\n',
    );
  });

  test('pages already edited have nothing to change', () => {
    merged();
    seed();
    expect(duplicatePages(1, 2, { live: true, cache, root, log })).toBe(true);
    expect(out).toEqual([
      'src/content/wiki/ablaze.md: no marker for #2',
      'src/content/wiki-zh/ablaze.md: no marker for #2',
      'Nothing to change.',
    ]);
  });

  test('a kept question that is closed is refused before any change', () => {
    seed({ state: 'closed', state_reason: 'completed' });
    expect(duplicatePages(1, 2, { live: true, cache, root, log })).toBe(false);
    expect(out).toEqual([
      'error: #1 is closed, so it has no box; link the marker on #2’s page to its settled rule by hand',
    ]);
    expect(read('ablaze', 'en')).toContain('> [!ISSUE 2]');
  });
});

describe('the duplicate command, closing on GitHub', () => {
  test('it refuses while a page still holds the marker', () => {
    page('ablaze', 'en', 'Ablaze', 'See the open question on [[Burning#issue-1|Burning]].\n');
    const github = seed();
    expect(closeDuplicate(github, 1, 2, { live: true, cache, root, log })).toBe(false);
    expect(out).toEqual([
      'error: src/content/wiki-zh/ablaze.md:8 still holds the marker for #2; merge the pull request that replaces it first',
    ]);
    expect(github.writes).toEqual([]);
  });

  test('a dry run prints the GitHub changes and makes none', () => {
    merged();
    const github = seed();
    expect(closeDuplicate(github, 1, 2, { live: false, cache, root, log })).toBe(true);
    expect(github.writes).toEqual([]);
    expect(out).toEqual([
      '#2: would close as a duplicate of #1',
      '#2: would remove from milestone 1',
      'Dry run: 2 change(s). Add --live to make them.',
    ]);
  });

  test('a live run closes the duplicate, removes its milestone and refreshes the cache', () => {
    merged();
    const github = seed();
    expect(closeDuplicate(github, 1, 2, { live: true, cache, root, log })).toBe(true);
    const dropped = github.question(2);
    expect([dropped.state, dropped.state_reason, dropped.duplicateOf]).toEqual([
      'closed',
      'duplicate',
      1,
    ]);
    expect(dropped.milestone).toBeNull();
    expect(github.question(1).state).toBe('open');
    expect(loadQuestions(cache).get(2)?.duplicateOf).toBe(1);
    expect(out.slice(-2)).toEqual([
      'Made 2 change(s).',
      'Wrote 2 question(s) and 1 milestone(s) to .questions/',
    ]);
  });

  test('a kept question decided in the same group may be closed', () => {
    merged();
    const github = seed({ state: 'closed', state_reason: 'completed', comments: ['## Answer'] });
    expect(closeDuplicate(github, 1, 2, { live: true, cache, root, log })).toBe(true);
    expect(github.question(2).duplicateOf).toBe(1);
  });

  test('a pair already closed has nothing to change', () => {
    merged();
    const github = seed(
      {},
      { state: 'closed', state_reason: 'duplicate', duplicateOf: 1, milestone: undefined },
    );
    expect(closeDuplicate(github, 1, 2, { live: false, cache, root, log })).toBe(true);
    expect(out).toEqual(['Nothing to change.']);
  });

  test('a duplicate closed as a duplicate of another question is refused', () => {
    merged();
    const github = fakeGitHub({
      issues: [
        question(1, 'burning'),
        question(2, 'ablaze', { state: 'closed', state_reason: 'duplicate', duplicateOf: 3 }),
        question(3, 'burning'),
      ],
    });
    expect(closeDuplicate(github, 1, 2, { live: true, cache, root, log })).toBe(false);
    expect(out).toEqual(['error: #2 is already closed as a duplicate of #3']);
    expect(github.writes).toEqual([]);
  });

  test('a kept question that is itself a duplicate is refused', () => {
    merged();
    const github = fakeGitHub({
      issues: [
        question(1, 'burning', { state: 'closed', state_reason: 'duplicate', duplicateOf: 3 }),
        question(2, 'ablaze'),
        question(3, 'burning'),
      ],
    });
    expect(closeDuplicate(github, 1, 2, { live: true, cache, root, log })).toBe(false);
    expect(out).toEqual(['error: #1 is itself a duplicate of #3; use #3']);
    expect(github.writes).toEqual([]);
  });
});
