import { describe, expect, test } from 'bun:test';
import { editRow, parsePlan, planChanges } from './links';

describe('parsePlan', () => {
  test('reads blocked-by, related and undermined-by lines with their reasons', () => {
    const plan = [
      'add #16 blocked-by #15: #16 needs the list #15 confirms.',
      'add #66 related #67: both ask about Faded memories.',
      'add #24 undermined-by #120: #120 broke its premise.',
    ].join('\n');
    expect(parsePlan(plan)).toEqual([
      {
        action: 'add',
        relation: 'blocked-by',
        issue: 16,
        other: 15,
        reason: '#16 needs the list #15 confirms.',
      },
      {
        action: 'add',
        relation: 'related',
        issue: 66,
        other: 67,
        reason: 'both ask about Faded memories.',
      },
      {
        action: 'add',
        relation: 'undermined-by',
        issue: 24,
        other: 120,
        reason: '#120 broke its premise.',
      },
    ]);
  });

  test('in a Markdown proposal, reads only the question-links blocks', () => {
    const proposal = [
      '# Links plan',
      '',
      'add #1 related #2: prose outside the block is not the plan.',
      '',
      '```question-links',
      '# Memory',
      '',
      'remove #16 blocked-by #15: wrong order.',
      '```',
    ].join('\n');
    expect(parsePlan(proposal)).toEqual([
      { action: 'remove', relation: 'blocked-by', issue: 16, other: 15, reason: 'wrong order.' },
    ]);
  });

  test('rejects a line it cannot read, naming the line', () => {
    const plan = 'add #16 blocked-by #15: fine.\n\nadd #16 blocks #15: unknown relation.';
    expect(() => parsePlan(plan)).toThrow('line 3: add #16 blocks #15: unknown relation.');
  });

  test('rejects an issue linked to itself', () => {
    expect(() => parsePlan('add #16 related #16: same issue.')).toThrow('line 1');
  });
});

const SECTIONS = [
  '## Context',
  '',
  '| Option | Effect |',
  '|---|---|',
  '| A | B |',
  '',
  '## en',
  '',
  'English text.',
  '',
  '## zh',
  '',
  '### 中文标题',
  '',
  '中文。',
].join('\n');

function body(...rows: string[]): string {
  return ['| Property | Value |', '|---|---|', ...rows, '', SECTIONS].join('\n');
}

const PAGE = '| Page | [Ablaze](https://tagc.github.io/oneiros/wiki/ablaze/) |';
const RAISED = '| Raised | 21 Nov 2026 |';

describe('editRow', () => {
  test('adds issues to an existing row in number order', () => {
    const before = body(PAGE, '| Related | #139 |', RAISED);
    expect(editRow(before, 'Related', { add: [145, 12] })).toBe(
      body(PAGE, '| Related | #12, #139, #145 |', RAISED),
    );
  });

  test('inserts a missing row in the README order and leaves the rest alone', () => {
    const before = body(PAGE, RAISED, '| Undermined by | #208 |');
    expect(editRow(before, 'Related', { add: [139] })).toBe(
      body(PAGE, RAISED, '| Related | #139 |', '| Undermined by | #208 |'),
    );
  });

  test('drops a row left empty, and reads links written as issue URLs', () => {
    const before = body(PAGE, '| related | https://github.com/TAGC/oneiros/issues/139 |', RAISED);
    expect(editRow(before, 'Related', { remove: [139] })).toBe(body(PAGE, RAISED));
  });

  test('starts a property table when the body has none', () => {
    expect(editRow(SECTIONS, 'Undermined by', { add: [208] })).toBe(
      body('| Undermined by | #208 |'),
    );
  });

  test('leaves a body with no table alone when there is nothing to add', () => {
    expect(editRow(SECTIONS, 'Related', { remove: [7] })).toBe(SECTIONS);
  });

  test('keeps the line endings GitHub sent', () => {
    const before = body(PAGE).replace(/\n/g, '\r\n');
    expect(editRow(before, 'Related', { add: [7] })).toBe(
      body(PAGE, '| Related | #7 |').replace(/\n/g, '\r\n'),
    );
  });
});

describe('planChanges', () => {
  const issues = new Map([
    [15, { body: body(PAGE), blockedBy: [] }],
    [16, { body: body(PAGE), blockedBy: [15] }],
    [17, { body: body(PAGE, '| Undermined by | #9 |'), blockedBy: [] }],
  ]);

  test('writes a Related row on both issues and an Undermined by row on one', () => {
    const plan = parsePlan('add #15 related #16\nadd #17 undermined-by #15');
    expect(planChanges(plan, issues).bodies).toEqual([
      { issue: 15, before: body(PAGE), after: body(PAGE, '| Related | #16 |') },
      { issue: 16, before: body(PAGE), after: body(PAGE, '| Related | #15 |') },
      {
        issue: 17,
        before: body(PAGE, '| Undermined by | #9 |'),
        after: body(PAGE, '| Undermined by | #9, #15 |'),
      },
    ]);
  });

  test('lists only the blocked-by links that change, and says which it skips', () => {
    const plan = parsePlan(
      'add #16 blocked-by #15\nadd #17 blocked-by #16\nremove #15 blocked-by #17',
    );
    const result = planChanges(plan, issues);
    expect(result.block).toEqual([{ issue: 17, blocker: 16 }]);
    expect(result.unblock).toEqual([]);
    expect(result.skipped).toEqual(['#16 is already blocked by #15', '#15 is not blocked by #17']);
    expect(result.bodies).toEqual([]);
  });

  test('fails on a plan that both adds and removes one link', () => {
    const plan = parsePlan('add #15 related #16\nremove #16 related #15');
    expect(() => planChanges(plan, issues)).toThrow('#16 related #15');
  });

  test('fails on an issue it was not given', () => {
    expect(() => planChanges(parsePlan('add #15 related #99'), issues)).toThrow('#99');
  });
});
