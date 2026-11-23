import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, writeQuestionCache } from '.';
import { type Clustering, clusterList } from './clusters';
import {
  type GithubMilestone,
  loadConstellations,
  type MilestonedIssue,
  writeMilestoneCache,
} from './constellations';

type Fixture = PulledIssue & MilestonedIssue;

function issue(
  number: number,
  inMilestone?: number,
  area: string | null = 'memory',
  fields: Partial<Fixture> = {},
): Fixture {
  return {
    number,
    title: `Question ${number}`,
    body: '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。',
    state: 'open',
    state_reason: null,
    labels: [{ name: 'kind:open' }, ...(area ? [{ name: `area:${area}` }] : [])],
    html_url: `https://github.com/TAGC/oneiros/issues/${number}`,
    milestone: inMilestone === undefined ? null : { number: inMilestone },
    ...fields,
  };
}

const closed = (number: number, inMilestone?: number, area?: string | null) =>
  issue(number, inMilestone, area, {
    state: 'closed',
    state_reason: 'completed',
  });

function milestone(
  number: number,
  fields: Partial<GithubMilestone> = {},
  zh: string | null = `星座 ${number}`,
): GithubMilestone {
  const section = zh ? `### ${zh}\n\n为何。` : '为何。';
  return {
    number,
    title: `✦ Group ${number}`,
    description: `| Property | Value |\n|---|---|\n| Size | Small |\n| Energy | Low |\n\n## en\n\nWhy.\n\n## zh\n\n${section}`,
    state: 'open',
    html_url: `https://github.com/TAGC/oneiros/milestone/${number}`,
    ...fields,
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'clusters-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes the cache as the pull does, loads it back and lists its clusters. */
function clusters(
  issues: Fixture[],
  milestones: GithubMilestone[] | undefined,
  by: Clustering,
  locale: 'en' | 'zh' = 'en',
) {
  writeQuestionCache(dir, issues);
  writeMilestoneCache(dir, milestones ?? [], issues);
  const questions = loadQuestions(dir);
  const constellations = milestones ? loadConstellations(dir, questions) : undefined;
  return clusterList(questions.all(), constellations, by, locale);
}

const shape = (list: ReturnType<typeof clusterList>) =>
  list.map((c) => [c.kind, c.constellation ?? c.area, c.questions]);

describe('the clusters by constellation', () => {
  test('list open constellations, then the questions in none, then finished constellations', () => {
    const issues = [issue(1, 8), issue(2, 3), issue(3), closed(4, 5), closed(5, 2)];
    const milestones = [
      milestone(2, { state: 'closed' }),
      milestone(3),
      milestone(5),
      milestone(8),
    ];
    expect(shape(clusters(issues, milestones, 'constellations'))).toEqual([
      ['constellation', 3, [2]],
      ['constellation', 8, [1]],
      ['none', undefined, [3]],
      ['finished', 2, [5]],
      ['finished', 5, [4]],
    ]);
  });

  test('keep a settled question in its open constellation', () => {
    const issues = [issue(1, 3), closed(2, 3)];
    expect(shape(clusters(issues, [milestone(3)], 'constellations'))).toEqual([
      ['constellation', 3, [1, 2]],
    ]);
  });

  test('put a question reopened in a finished constellation in none', () => {
    const issues = [issue(1, 5), closed(2, 5)];
    const milestones = [milestone(5, { state: 'closed' })];
    expect(shape(clusters(issues, milestones, 'constellations'))).toEqual([
      ['none', undefined, [1]],
      ['finished', 5, [2]],
    ]);
  });

  test('put open and settled questions of no constellation in none', () => {
    const issues = [issue(1, 3), issue(2), closed(4), issue(9, 6)];
    const milestones = [milestone(3), milestone(6, { title: 'Release 1' })];
    expect(shape(clusters(issues, milestones, 'constellations'))).toEqual([
      ['constellation', 3, [1]],
      ['none', undefined, [2, 4, 9]],
    ]);
  });

  test('leave duplicates out of every cluster', () => {
    const duplicate = issue(2, 3, 'memory', {
      state: 'closed',
      state_reason: 'duplicate',
      duplicateOf: 1,
    });
    const loose = issue(4, undefined, 'memory', {
      state: 'closed',
      state_reason: 'duplicate',
      duplicateOf: 1,
    });
    const issues = [issue(1, 3), duplicate, loose];
    expect(shape(clusters(issues, [milestone(3)], 'constellations'))).toEqual([
      ['constellation', 3, [1]],
    ]);
  });

  test('leave out a constellation with no questions', () => {
    expect(shape(clusters([issue(1)], [milestone(6)], 'constellations'))).toEqual([
      ['none', undefined, [1]],
    ]);
  });

  test('are one cluster of every question without constellation data', () => {
    const issues = [issue(1), closed(2, 3)];
    expect(shape(clusters(issues, undefined, 'constellations'))).toEqual([
      ['none', undefined, [1, 2]],
    ]);
  });
});

describe('the clusters by area', () => {
  test('list the areas in the wiki order, then the questions of no area', () => {
    const duplicate = issue(5, 6, 'memory', {
      state: 'closed',
      state_reason: 'duplicate',
      duplicateOf: 1,
    });
    const issues = [
      issue(1, 3, 'world'),
      issue(2, undefined, null),
      issue(3, 3, 'beliefs'),
      closed(4, 5, 'world'),
      duplicate,
    ];
    expect(shape(clusters(issues, [milestone(3)], 'areas'))).toEqual([
      ['area', 'Beliefs', [3]],
      ['area', 'World', [1, 4]],
      ['none', undefined, [2]],
    ]);
  });
});

describe('what a cluster holds', () => {
  const facts = (list: ReturnType<typeof clusterList>) =>
    list.map((c) => ({ name: c.name, open: c.open, total: c.total }));

  test('a constellation’s name in the locale, or in English, and its open and total counts', () => {
    const issues = [issue(1, 3), closed(2, 3), issue(3, 4), closed(4, 5), issue(5)];
    const milestones = [milestone(3), milestone(4, {}, null), milestone(5)];
    expect(facts(clusters(issues, milestones, 'constellations', 'zh'))).toEqual([
      { name: { text: '星座 3', lang: 'zh' }, open: 1, total: 2 },
      { name: { text: 'Group 4', lang: 'en' }, open: 1, total: 1 },
      { name: undefined, open: 1, total: 1 },
      { name: { text: '星座 5', lang: 'zh' }, open: 0, total: 1 },
    ]);
  });

  test('an area’s name in the locale', () => {
    const issues = [issue(1, undefined, 'world'), closed(2, undefined, 'world')];
    expect(facts(clusters(issues, undefined, 'areas', 'zh'))).toEqual([
      { name: { text: '世界', lang: 'zh' }, open: 1, total: 2 },
    ]);
    expect(facts(clusters(issues, undefined, 'areas', 'en'))[0].name).toEqual({
      text: 'World',
      lang: 'en',
    });
  });
});
