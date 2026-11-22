import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, writeQuestionCache } from '.';
import {
  constellationProblems,
  type GithubMilestone,
  loadConstellations,
  type MilestonedIssue,
  writeMilestoneCache,
} from './constellations';

type Fixture = PulledIssue & MilestonedIssue;

function issue(number: number, inMilestone?: number, fields: Partial<Fixture> = {}): Fixture {
  return {
    number,
    title: `Question ${number}`,
    body: '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。',
    state: 'open',
    state_reason: null,
    labels: [{ name: 'kind:open' }, { name: 'area:memory' }],
    html_url: `https://github.com/TAGC/oneiros/issues/${number}`,
    milestone: inMilestone === undefined ? null : { number: inMilestone },
    ...fields,
  };
}

const closed = (number: number, inMilestone?: number) =>
  issue(number, inMilestone, { state: 'closed', state_reason: 'completed' });

const DESCRIPTION = `| Property | Value |
|---|---|
| Size | Small |
| Energy | low |

## en

Both ask how memories fade.

## zh

### 褪色的记忆

两者都问记忆如何褪色。`;

function milestone(fields: Partial<GithubMilestone> & { number: number }): GithubMilestone {
  return {
    title: '✦ Fading memories',
    description: DESCRIPTION,
    state: 'open',
    html_url: `https://github.com/TAGC/oneiros/milestone/${fields.number}`,
    ...fields,
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'constellations-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes the cache as the pull does, then loads it back. */
function load(issues: Fixture[], milestones: GithubMilestone[]) {
  writeQuestionCache(dir, issues);
  writeMilestoneCache(dir, milestones, issues);
  return loadConstellations(dir, loadQuestions(dir));
}

const numbers = (list: { number: number }[]) => list.map((q) => q.number);

describe('loading constellations from milestones', () => {
  test('reads a milestone as a constellation in both languages', () => {
    const [c] = load([issue(145, 3), issue(142, 3)], [milestone({ number: 3 })]).all();
    expect(c.number).toBe(3);
    expect(c.url).toBe('https://github.com/TAGC/oneiros/milestone/3');
    expect(c.state).toBe('open');
    expect(c.name).toEqual({ en: 'Fading memories', zh: '褪色的记忆' });
    expect(c.reasoning).toEqual({
      en: 'Both ask how memories fade.',
      zh: '两者都问记忆如何褪色。',
    });
    expect(c.size).toBe('small');
    expect(c.energy).toBe('low');
    expect(numbers(c.questions)).toEqual([142, 145]);
  });

  test('finds the constellation holding a question', () => {
    const constellations = load([issue(142, 3), issue(7)], [milestone({ number: 3 })]);
    expect(constellations.of(142)?.number).toBe(3);
    expect(constellations.of(7)).toBeUndefined();
  });

  test('no milestones means no constellations', () => {
    expect(load([issue(1)], []).all()).toEqual([]);
    expect(loadConstellations(join(dir, 'none'), loadQuestions(join(dir, 'none'))).all()).toEqual(
      [],
    );
  });

  test('keeps closed questions in their constellation', () => {
    const [c] = load([issue(142, 3), closed(145, 3)], [milestone({ number: 3 })]).all();
    expect(c.questions.map((q) => [q.number, q.state])).toEqual([
      [142, 'open'],
      [145, 'closed'],
    ]);
  });

  test('leaves duplicates out of their constellation', () => {
    const duplicate = issue(145, 3, {
      state: 'closed',
      state_reason: 'duplicate',
      duplicateOf: 142,
    });
    const [c] = load([issue(142, 3), duplicate], [milestone({ number: 3 })]).all();
    expect(numbers(c.questions)).toEqual([142]);
  });

  test('lists every constellation but only open ones to draw', () => {
    const milestones = [milestone({ number: 3 }), milestone({ number: 4, state: 'closed' })];
    const constellations = load([issue(142, 3), closed(145, 4)], milestones);
    expect(numbers(constellations.all())).toEqual([3, 4]);
    expect(numbers(constellations.open())).toEqual([3]);
  });

  test('finishes a constellation at once when all its questions close, before its milestone does', () => {
    const milestones = [
      milestone({ number: 3 }),
      milestone({ number: 4 }),
      milestone({ number: 5, state: 'closed' }),
    ];
    const issues = [closed(142, 3), closed(145, 3), issue(150, 4), closed(151, 4), closed(160, 5)];
    const constellations = load(issues, milestones);
    expect(numbers(constellations.open())).toEqual([4]);
    expect(numbers(constellations.finished())).toEqual([3, 5]);
    expect(numbers(constellations.toClose())).toEqual([3]);
  });

  test('keeps an empty open milestone open: it has nothing to finish', () => {
    const constellations = load([issue(1)], [milestone({ number: 6 })]);
    expect(numbers(constellations.open())).toEqual([6]);
    expect(numbers(constellations.finished())).toEqual([]);
  });

  test('counts a reopened question in a finished constellation as ungrouped', () => {
    const issues = [issue(142, 5), closed(145, 5)];
    const constellations = load(issues, [milestone({ number: 5, state: 'closed' })]);
    expect(numbers(constellations.ungrouped())).toEqual([142]);
    expect(numbers(constellations.finished())).toEqual([5]);
  });

  test('ignores milestones without the constellation mark', () => {
    const milestones = [milestone({ number: 3 }), milestone({ number: 5, title: 'Release 1' })];
    const constellations = load([issue(142, 3), issue(150, 5)], milestones);
    expect(numbers(constellations.all())).toEqual([3]);
    expect(constellations.of(150)).toBeUndefined();
  });

  test('reports open questions in no open constellation, by number', () => {
    const milestones = [
      milestone({ number: 3 }),
      milestone({ number: 4, state: 'closed' }),
      milestone({ number: 5, title: 'Release 1' }),
    ];
    const issues = [issue(142, 3), issue(9), issue(3, 4), issue(150, 5), closed(4)];
    expect(numbers(load(issues, milestones).ungrouped())).toEqual([3, 9, 150]);
  });

  test('a malformed description still loads', () => {
    const [c] = load([issue(142, 3)], [milestone({ number: 3, description: null })]).all();
    expect(c.name).toEqual({ en: 'Fading memories' });
    expect(c.reasoning).toEqual({});
    expect(c.size).toBeUndefined();
    expect(c.energy).toBeUndefined();
  });
});

describe('constellation checks', () => {
  function problems(description: string, state: 'open' | 'closed' = 'open') {
    const constellations = load([issue(142, 3)], [milestone({ number: 3, description, state })]);
    return constellationProblems(constellations).map((p) => p.message);
  }

  test('pass a well-formed description', () => {
    expect(problems(DESCRIPTION)).toEqual([]);
  });

  test('fail on a missing or invalid Size', () => {
    expect(problems(DESCRIPTION.replace('| Size | Small |\n', ''))).toEqual([
      'no Size row; use one of small, medium, large',
    ]);
    expect(problems(DESCRIPTION.replace('Small', 'Huge'))).toEqual([
      'Size "Huge" is not one of small, medium, large',
    ]);
  });

  test('fail on a missing or invalid Energy', () => {
    expect(problems(DESCRIPTION.replace('| Energy | low |\n', ''))).toEqual([
      'no Energy row; use one of low, medium, high',
    ]);
    expect(problems(DESCRIPTION.replace('| low |', '| none |'))).toEqual([
      'Energy "none" is not one of low, medium, high',
    ]);
  });

  test('fail on a missing English reasoning', () => {
    expect(problems(DESCRIPTION.replace('## en\n\nBoth ask how memories fade.\n\n', ''))).toEqual([
      'no `## en` section with the reasoning',
    ]);
  });

  test('fail on a missing Chinese section or Chinese name', () => {
    expect(problems(DESCRIPTION.replace(/\n\n## zh[\s\S]*$/, ''))).toEqual([
      'no `## zh` section with the reasoning',
    ]);
    expect(problems(DESCRIPTION.replace('### 褪色的记忆\n\n', ''))).toEqual([
      'the `## zh` section has no `### ` name line',
    ]);
  });

  test('skip closed constellations, which are not drawn', () => {
    expect(problems('', 'closed')).toEqual([]);
  });

  test('report the milestone', () => {
    const constellations = load([issue(142, 3)], [milestone({ number: 3, description: '' })]);
    const where = new Set(constellationProblems(constellations).map((p) => p.where));
    expect([...where]).toEqual(['https://github.com/TAGC/oneiros/milestone/3']);
  });
});
