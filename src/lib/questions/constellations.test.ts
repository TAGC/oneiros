import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestions, type PulledIssue, writeQuestionCache } from '.';
import { constellationProblems, loadConstellations } from './constellations';

function issue(fields: Partial<PulledIssue> & { number: number }): PulledIssue {
  return {
    title: `Question ${fields.number}`,
    body: '## en\n\nEnglish text.\n\n## zh\n\n### 中文标题\n\n中文。',
    state: 'open',
    state_reason: null,
    labels: [{ name: 'kind:open' }, { name: 'area:memory' }],
    html_url: `https://github.com/TAGC/oneiros/issues/${fields.number}`,
    ...fields,
  };
}

const closed = (number: number) => issue({ number, state: 'closed', state_reason: 'completed' });

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'constellations-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes a question cache and a constellations file, and returns both paths' contents loaded. */
function setUp(issues: PulledIssue[], yaml: string) {
  const cache = join(dir, 'cache');
  writeQuestionCache(cache, issues);
  const file = join(dir, 'constellations.yaml');
  writeFileSync(file, yaml);
  return { file, questions: loadQuestions(cache) };
}

function load(issues: PulledIssue[], yaml: string) {
  const { file, questions } = setUp(issues, yaml);
  return loadConstellations(file, questions);
}

function problems(
  issues: PulledIssue[],
  yaml: string,
  lookup?: Parameters<typeof constellationProblems>[2],
) {
  const { file, questions } = setUp(issues, yaml);
  return constellationProblems(file, questions, lookup).map((p) => p.message);
}

const MEMORY = `
- name:
    en: Fading memories
    zh: 褪色的记忆
  reasoning:
    en: Both ask how memories fade.
    zh: 两者都问记忆如何褪色。
  size: small
  energy: low
  issues: [142, 145]
`;

describe('loading constellations', () => {
  test('reads each constellation with its open questions in file order', () => {
    const all = load([issue({ number: 145 }), issue({ number: 142 })], MEMORY).all();
    expect(all).toHaveLength(1);
    const [c] = all;
    expect(c.name).toEqual({ en: 'Fading memories', zh: '褪色的记忆' });
    expect(c.reasoning).toEqual({
      en: 'Both ask how memories fade.',
      zh: '两者都问记忆如何褪色。',
    });
    expect(c.size).toBe('small');
    expect(c.energy).toBe('low');
    expect(c.questions.map((q) => q.number)).toEqual([142, 145]);
  });

  test('finds the constellation holding a question', () => {
    const constellations = load([issue({ number: 142 }), issue({ number: 145 })], MEMORY);
    expect(constellations.of(145)?.name.en).toBe('Fading memories');
    expect(constellations.of(7)).toBeUndefined();
  });

  test('a missing or empty file holds no constellations', () => {
    const questions = loadQuestions(join(dir, 'none'));
    expect(loadConstellations(join(dir, 'missing.yaml'), questions).all()).toEqual([]);
    expect(load([], '# nothing yet\n').all()).toEqual([]);
  });

  test('drops closed issues and issues that are not question issues', () => {
    const c = load([issue({ number: 142 }), closed(145)], MEMORY.replace('145]', '145, 999]'));
    expect(c.all()[0].questions.map((q) => q.number)).toEqual([142]);
    expect(c.of(145)).toBeUndefined();
  });

  test('drops a constellation left with no open questions', () => {
    expect(load([closed(142)], MEMORY).all()).toEqual([]);
  });

  test('keeps a question only in the first constellation that names it', () => {
    const twice = `${MEMORY}${MEMORY.replace('Fading memories', 'Again').replace('[142, 145]', '[145]')}`;
    const c = load([issue({ number: 142 }), issue({ number: 145 })], twice);
    expect(c.all()).toHaveLength(1);
    expect(c.of(145)?.name.en).toBe('Fading memories');
  });

  test('reports open questions in no constellation, by number', () => {
    const issues = [issue({ number: 142 }), issue({ number: 9 }), issue({ number: 3 }), closed(4)];
    const ungrouped = load(issues, MEMORY).ungrouped();
    expect(ungrouped.map((q) => q.number)).toEqual([3, 9]);
  });

  test('a constellation without Chinese text still loads', () => {
    const english = MEMORY.replace(/\n {4}zh: .*/g, '');
    const [c] = load([issue({ number: 142 })], english).all();
    expect(c.name).toEqual({ en: 'Fading memories' });
  });

  test('a malformed file fails to load', () => {
    const issues = [issue({ number: 142 })];
    expect(() => load(issues, MEMORY.replace('size: small', 'size: huge'))).toThrow(/size/);
    expect(() => load(issues, 'name: not a list\n')).toThrow(/list/);
  });
});

describe('the strict constellations check', () => {
  const open = [issue({ number: 142 }), issue({ number: 145 })];

  test('passes a sound file, an empty one and a missing one', () => {
    expect(problems(open, MEMORY)).toEqual([]);
    expect(problems([], '# nothing yet\n')).toEqual([]);
    const questions = loadQuestions(join(dir, 'none'));
    expect(constellationProblems(join(dir, 'missing.yaml'), questions)).toEqual([]);
  });

  test('does not fail on ungrouped open questions', () => {
    expect(problems([...open, issue({ number: 3 })], MEMORY)).toEqual([]);
  });

  test('fails on a closed issue', () => {
    expect(problems([issue({ number: 142 }), closed(145)], MEMORY)).toEqual([
      '#145 is closed; remove it',
    ]);
  });

  test('fails on a missing issue', () => {
    const lookup = (n: number) => (n === 145 ? ('missing' as const) : undefined);
    expect(problems([issue({ number: 142 })], MEMORY, lookup)).toEqual(['#145 does not exist']);
  });

  test('fails on an issue without a kind label', () => {
    const lookup = () => 'not-question' as const;
    expect(problems([issue({ number: 142 })], MEMORY, lookup)).toEqual([
      '#145 has no kind:open or kind:conflict label',
    ]);
  });

  test('without a lookup, an issue missing from the cache still fails', () => {
    const [message] = problems([issue({ number: 142 })], MEMORY);
    expect(message).toStartWith('#145 is not a question issue');
  });

  test('fails on a missing Chinese name or reasoning', () => {
    expect(problems(open, MEMORY.replace(/\n {4}zh: 褪色的记忆/, ''))).toEqual(['no `name.zh`']);
    expect(problems(open, MEMORY.replace(/\n {4}zh: 两者.*/, ''))).toEqual(['no `reasoning.zh`']);
  });

  test('fails on an issue named twice, in one constellation or across two', () => {
    expect(problems(open, MEMORY.replace('[142, 145]', '[142, 145, 142]'))).toEqual([
      '#142 is named twice; it is already in "Fading memories" (line 2)',
    ]);
    const again = MEMORY.replace('Fading memories', 'Again').replace('[142, 145]', '[145]');
    expect(problems(open, MEMORY + again)).toEqual([
      '#145 is named twice; it is already in "Fading memories" (line 2)',
    ]);
  });

  test('fails on a malformed file instead of throwing', () => {
    expect(problems(open, MEMORY.replace('energy: low', 'energy: none'))).toEqual([
      '`energy` must be one of low, medium, high',
    ]);
    expect(problems(open, MEMORY.replace('size: small', 'sise: small'))).toEqual([
      'unknown key `sise`',
      '`size` must be one of small, medium, large',
    ]);
    expect(problems(open, MEMORY.replace('[142, 145]', '[142, "#145"]'))).toEqual([
      '`issues` holds "#145", not an issue number',
    ]);
    expect(problems(open, 'name: [unclosed\n')).toHaveLength(1);
  });

  test('reports the line of each problem', () => {
    const { file, questions } = setUp([issue({ number: 142 }), closed(145)], MEMORY);
    expect(constellationProblems(file, questions).map((p) => p.where)).toEqual([`${file}:10`]);
  });
});
