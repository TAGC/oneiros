/**
 * The question graph: every fact derived from the links between questions, in one place.
 * The terms are defined in `docs/open-questions.md`. A blocker counts as settled only when
 * it is decided or ruled out: an undermined decision stands on a broken premise, and a
 * blocker missing from the cache is unknown. Only open questions count as depending on
 * another. Duplicates are left out; the loader has already turned links to them into links
 * to their canonical question.
 */
import { type Question, withoutDuplicates } from '.';

/** A question is central when it directly blocks at least this many open questions. */
export const CENTRAL_MIN_DEPENDENTS = 3;

/** Open and ready to ask, open and waiting on an unsettled blocker, or closed. */
export type Place = 'frontier' | 'blocked' | 'settled';

/** Independent questions are always peripheral too. */
export type Role = 'central' | 'peripheral' | 'independent';

const ROLES: Role[] = ['central', 'peripheral', 'independent'];

/**
 * A blocked-by link runs from blocker to blocked: `settled` when the blocker is decided or
 * ruled out, else `unsettled`. An `undermines` link runs from a question to the decision whose
 * premise it broke.
 */
export type ThreadKind = 'unsettled' | 'settled' | 'undermines';

export const THREAD_KINDS: ThreadKind[] = ['unsettled', 'settled', 'undermines'];

/** A link between two questions in the graph. */
export interface Thread {
  from: number;
  to: number;
  kind: ThreadKind;
}

/** One question's facts. */
export interface GraphQuestion {
  number: number;
  place: Place;
  /**
   * The longest chain of unsettled blockers in front of an open question; 0 on the frontier
   * and for a settled question. A closed or missing unsettled blocker counts as one step. In
   * a blocked-by cycle, or waiting on one, it is capped at the number of open questions.
   */
  stepsOut: number;
  /** Its blockers, canonical and sorted, whether or not they are in the graph. */
  blockedBy: number[];
  /** The open questions it directly blocks, sorted. */
  dependents: number[];
  /** In `ROLES` order. */
  roles: Role[];
}

/** Plain, JSON-safe data, so a page can hand it to client code as it is. */
export interface QuestionGraph {
  /** Every question but duplicates, by number. */
  questions: Record<number, GraphQuestion>;
  /** Every link between two questions in the graph, by `from` and then `to`. */
  threads: Thread[];
  /** Each blocked-by cycle's questions, sorted, in order of their first; a check failure. */
  cycles: number[][];
}

/**
 * The blocked-by cycles among `questions`: each strongly connected group of two or more, or a
 * question that blocks itself, as sorted numbers, in order of their first.
 */
function blockedByCycles(questions: Question[], byNumber: Map<number, Question>): number[][] {
  const index = new Map<number, number>();
  const low = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const cycles: number[][] = [];
  const visit = (n: number) => {
    index.set(n, index.size);
    low.set(n, index.get(n)!);
    stack.push(n);
    onStack.add(n);
    for (const b of byNumber.get(n)!.blockedBy) {
      if (!byNumber.has(b)) continue;
      if (!index.has(b)) {
        visit(b);
        low.set(n, Math.min(low.get(n)!, low.get(b)!));
      } else if (onStack.has(b)) low.set(n, Math.min(low.get(n)!, index.get(b)!));
    }
    if (low.get(n) !== index.get(n)) return;
    const group: number[] = [];
    let m: number;
    do {
      m = stack.pop()!;
      onStack.delete(m);
      group.push(m);
    } while (m !== n);
    if (group.length > 1 || byNumber.get(n)!.blockedBy.includes(n)) {
      cycles.push(group.sort((a, b) => a - b));
    }
  };
  for (const q of questions) if (!index.has(q.number)) visit(q.number);
  return cycles.sort((a, b) => a[0] - b[0]);
}

export function questionGraph(all: Question[]): QuestionGraph {
  const questions = withoutDuplicates(all);
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  const settled = (n: number) => {
    const status = byNumber.get(n)?.status;
    return status === 'decided' || status === 'ruled-out';
  };
  const blockersOf = (q: Question) => [...new Set(q.blockedBy)].sort((a, b) => a - b);

  const dependents = new Map<number, number[]>(questions.map((q) => [q.number, []]));
  for (const q of questions) {
    if (q.status !== 'open') continue;
    for (const b of blockersOf(q)) dependents.get(b)?.push(q.number);
  }

  const linked = new Set<number>();
  for (const q of questions) {
    for (const n of [...q.blockedBy, ...q.underminedBy]) linked.add(n);
    if (q.blockedBy.length || q.underminedBy.length) linked.add(q.number);
    for (const n of q.properties.related ?? []) {
      if (byNumber.has(n)) linked.add(n).add(q.number);
    }
  }

  const cycles = blockedByCycles(questions, byNumber);
  const inCycle = new Set(cycles.flat());
  const cap = questions.filter((q) => q.status === 'open').length;
  const steps = new Map<number, number>();
  const stepsOut = (q: Question): number => {
    if (q.status !== 'open') return 0;
    if (inCycle.has(q.number)) return cap;
    const known = steps.get(q.number);
    if (known !== undefined) return known;
    let longest = 0;
    for (const b of blockersOf(q)) {
      if (settled(b)) continue;
      const blocker = byNumber.get(b);
      longest = Math.max(longest, blocker?.status === 'open' ? stepsOut(blocker) + 1 : 1);
    }
    steps.set(q.number, Math.min(cap, longest));
    return steps.get(q.number)!;
  };

  const records: Record<number, GraphQuestion> = {};
  for (const q of questions) {
    const open = q.status === 'open';
    const blockedBy = blockersOf(q);
    const ready = blockedBy.every(settled) && !inCycle.has(q.number);
    const place: Place = !open ? 'settled' : ready ? 'frontier' : 'blocked';
    const mine = dependents.get(q.number)!;
    const has: Record<Role, boolean> = {
      central: open && mine.length >= CENTRAL_MIN_DEPENDENTS,
      peripheral: place === 'frontier' && mine.length === 0,
      independent: open && !linked.has(q.number),
    };
    records[q.number] = {
      number: q.number,
      place,
      stepsOut: stepsOut(q),
      blockedBy,
      dependents: mine,
      roles: ROLES.filter((r) => has[r]),
    };
  }
  const threads: Thread[] = [];
  for (const q of questions) {
    for (const b of blockersOf(q)) {
      if (byNumber.has(b)) {
        threads.push({ from: b, to: q.number, kind: settled(b) ? 'settled' : 'unsettled' });
      }
    }
    for (const u of new Set(q.underminedBy)) {
      if (byNumber.has(u)) threads.push({ from: u, to: q.number, kind: 'undermines' });
    }
  }
  threads.sort((a, b) => a.from - b.from || a.to - b.to);
  return { questions: records, threads, cycles };
}
