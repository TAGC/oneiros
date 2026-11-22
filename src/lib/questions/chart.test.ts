import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, writeQuestionCache } from '.';
import { chartOperations, currentChart, type PlannedConstellation, stateReport } from './chart';
import { writeConstellation } from './constellation-format';
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

function planned(fields: Partial<PlannedConstellation> = {}): PlannedConstellation {
  return {
    name: { en: 'Fading memories', zh: '褪色的记忆' },
    size: 'small',
    energy: 'low',
    reasoning: { en: 'How memories fade.', zh: '记忆如何褪色。' },
    questions: [142, 145],
    ...fields,
  };
}

function milestone(
  number: number,
  fields: Partial<GithubMilestone> = {},
  from: PlannedConstellation = planned(),
): GithubMilestone {
  return {
    number,
    ...writeConstellation(from),
    state: 'open',
    html_url: `https://github.com/TAGC/oneiros/milestone/${number}`,
    ...fields,
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chart-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes the cache as the pull does and reads back what the chart needs. */
function state(issues: Fixture[], milestones: GithubMilestone[]) {
  writeQuestionCache(dir, issues);
  writeMilestoneCache(dir, milestones, issues);
  const questions = loadQuestions(dir);
  return {
    questions,
    constellations: loadConstellations(dir, questions),
  };
}

function chart(issues: Fixture[], milestones: GithubMilestone[], plan: PlannedConstellation[]) {
  const s = state(issues, milestones);
  return chartOperations({ constellations: plan }, s.questions, s.constellations);
}

describe('milestone descriptions', () => {
  test('round-trip through the constellation loader and pass the checks', () => {
    const constellations = state([issue(142, 3)], [milestone(3)]).constellations;
    const [c] = constellations.all();
    expect(c.name).toEqual({ en: 'Fading memories', zh: '褪色的记忆' });
    expect(c.reasoning).toEqual({
      en: 'How memories fade.',
      zh: '记忆如何褪色。',
    });
    expect([c.size, c.energy]).toEqual(['small', 'low']);
    expect(constellationProblems(constellations)).toEqual([]);
  });
});

describe('charting operations', () => {
  test('create a new constellation and assign its questions', () => {
    const result = chart([issue(142), issue(145)], [], [planned()]);
    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      {
        kind: 'create',
        ref: 'Fading memories',
        title: '✦ Fading memories',
        description: writeConstellation(planned()).description,
      },
      { kind: 'assign', issue: 142, milestone: 'Fading memories' },
      { kind: 'assign', issue: 145, milestone: 'Fading memories' },
    ]);
  });

  test('change nothing when the plan is the current chart', () => {
    const s = state(
      [issue(142, 3), issue(145, 3), closed(150, 3), issue(7, 4)],
      [milestone(3), milestone(4, {}, planned({ name: { en: 'Lone', zh: '孤' }, questions: [7] }))],
    );
    const plan = currentChart(s.constellations);
    expect(plan.constellations.map((c) => [c.number, c.questions])).toEqual([
      [3, [142, 145]],
      [4, [7]],
    ]);
    expect(chartOperations(plan, s.questions, s.constellations)).toEqual({
      errors: [],
      warnings: [],
      operations: [],
    });
  });

  test('move a question and close the milestone it leaves empty', () => {
    const lone = planned({ name: { en: 'Lone', zh: '孤' }, questions: [7] });
    const result = chart(
      [issue(142, 3), issue(145, 3), issue(7, 4)],
      [milestone(3), milestone(4, {}, lone)],
      [planned({ number: 3, questions: [7, 142, 145], size: 'medium' })],
    );
    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      {
        kind: 'edit',
        number: 3,
        description: writeConstellation(planned({ size: 'medium' })).description,
      },
      { kind: 'assign', issue: 7, milestone: 3 },
      { kind: 'close', number: 4 },
    ]);
  });

  test('close a constellation whose questions are all closed', () => {
    const result = chart(
      [closed(142, 3), closed(145, 3), issue(7)],
      [milestone(3)],
      [planned({ name: { en: 'Lone', zh: '孤' }, questions: [7] })],
    );
    expect(result.operations.map((o) => o.kind)).toEqual(['create', 'assign', 'close']);
    expect(result.operations.at(-1)).toEqual({ kind: 'close', number: 3 });
  });

  test('rename a constellation through its title', () => {
    const result = chart(
      [issue(142, 3), issue(145, 3)],
      [milestone(3)],
      [planned({ number: 3, name: { en: 'Faded', zh: '褪色的记忆' } })],
    );
    expect(result.operations).toEqual([{ kind: 'edit', number: 3, title: '✦ Faded' }]);
  });

  test('leave milestones without the mark alone, but move their questions', () => {
    const result = chart(
      [issue(142, 5), issue(145, 5)],
      [milestone(5, { title: 'Release 1', description: 'Not a constellation.' })],
      [planned()],
    );
    expect(result.operations.map((o) => o.kind)).toEqual(['create', 'assign', 'assign']);
  });

  test('warn when the size does not fit the number of questions', () => {
    const result = chart([issue(142), issue(145)], [], [planned({ size: 'large' })]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      '"Fading memories" holds 2 questions; its size large usually means 6 or more',
    ]);
  });

  test('warn when the reasoning looks like it states counts', () => {
    const counted = planned({
      reasoning: { en: 'Both ask how memories fade.', zh: '两个问题都问记忆如何褪色。' },
    });
    const result = chart([issue(142), issue(145)], [], [counted]);
    expect(result.errors).toEqual([]);
    expect(result.operations).not.toEqual([]);
    expect(result.warnings).toEqual([
      '"Fading memories": the English reasoning may state counts ("Both"); name the shared theme only',
      '"Fading memories": the Chinese reasoning may state counts ("两个"); name the shared theme only',
    ]);
  });
});

describe('plan errors', () => {
  function errors(issues: Fixture[], milestones: GithubMilestone[], plan: PlannedConstellation[]) {
    const result = chart(issues, milestones, plan);
    if (result.errors.length) expect(result.operations).toEqual([]);
    return result.errors;
  }

  test('an open question in no constellation', () => {
    expect(errors([issue(142), issue(145), issue(7)], [], [planned()])).toEqual([
      '#7 is open but in no planned constellation',
    ]);
  });

  test('a question in two constellations', () => {
    const other = planned({ name: { en: 'Other', zh: '其他' }, questions: [145] });
    expect(errors([issue(142), issue(145)], [], [planned(), other])).toEqual([
      '#145 is in "Fading memories" and "Other"',
    ]);
  });

  test('a closed or unknown question', () => {
    expect(errors([issue(142), closed(145)], [], [planned({ questions: [142, 145, 9] })])).toEqual([
      '"Fading memories": #145 is not an open question',
      '"Fading memories": #9 is not an open question',
    ]);
  });

  test('an empty constellation', () => {
    const empty = planned({ name: { en: 'Empty', zh: '空' }, questions: [] });
    expect(errors([issue(142), issue(145)], [], [planned(), empty])).toEqual([
      '"Empty" holds no questions',
    ]);
  });

  test('a missing or off-scale field', () => {
    const bad = {
      ...planned(),
      size: 'huge',
      energy: undefined,
      name: { en: '✦ Fading memories', zh: '' },
      reasoning: { en: 'Why.' },
    } as unknown as PlannedConstellation;
    expect(errors([issue(142), issue(145)], [], [bad])).toEqual([
      '"✦ Fading memories": write the English name without the ✦ mark',
      '"✦ Fading memories": Size "huge" is not one of small, medium, large',
      '"✦ Fading memories": no Energy; use one of low, medium, high',
      '"✦ Fading memories": no Chinese name',
      '"✦ Fading memories": no Chinese reasoning',
    ]);
  });

  test('a name split at an unquoted comma', () => {
    const split = {
      ...planned(),
      name: { en: 'Crack', 'dun and the Dark malus': null, zh: '开裂' },
    } as unknown as PlannedConstellation;
    expect(errors([issue(142), issue(145)], [], [split])).toEqual([
      '"Crack": unknown name key "dun and the Dark malus"; quote text that holds a comma',
    ]);
  });

  test('a number that is not an open constellation', () => {
    const milestones = [
      milestone(3, { state: 'closed' }),
      milestone(5, { title: 'Release 1', description: '' }),
    ];
    expect(errors([issue(142), issue(145)], milestones, [planned({ number: 3 })])).toEqual([
      '"Fading memories": milestone 3 is not an open constellation',
    ]);
    expect(errors([issue(142), issue(145)], milestones, [planned({ number: 5 })])).toEqual([
      '"Fading memories": milestone 5 is not an open constellation',
    ]);
  });

  test('a title another milestone already has', () => {
    const milestones = [milestone(3, { state: 'closed' })];
    expect(errors([issue(142), issue(145)], milestones, [planned()])).toEqual([
      '"Fading memories": milestone 3 already has the title "✦ Fading memories"',
    ]);
  });

  test('two constellations with one name', () => {
    const twin = planned({ questions: [7] });
    expect(errors([issue(142), issue(145), issue(7)], [], [planned(), twin])).toEqual([
      'two planned constellations are named "Fading memories"',
    ]);
  });
});

describe('the state report', () => {
  test('lists each constellation with its questions and graph facts, then the rest', () => {
    const s = state(
      [
        issue(142, 3),
        issue(145, 3, { blockedBy: [{ number: 142 }] }),
        closed(150, 3),
        issue(7, undefined, { labels: [{ name: 'kind:conflict' }, { name: 'area:lore' }] }),
        closed(8, 4),
      ],
      [milestone(3), milestone(4, {}, planned({ name: { en: 'Settled', zh: '已定' } }))],
    );
    expect(stateReport(s.questions, s.constellations)).toBe(
      `3 open questions in 1 open constellation; 1 ungrouped.

## ✦ Fading memories (milestone 3): small, low, 2 open, 1 settled

- #142 open · Memory · Question 142 · frontier · blocks #145
- #145 open · Memory · Question 145 · blocked by #142

## Ungrouped

- #7 conflict · Lore · Question 7 · independent

## Ready to close

- ✦ Settled (milestone 4): no open questions`,
    );
  });
});
