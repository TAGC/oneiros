/**
 * The question graph: every fact derived from the links between questions, in one place.
 * The terms are defined in `docs/open-questions.md`. A blocker counts as settled only when
 * it is decided or ruled out: an undermined decision stands on a broken premise, and a
 * blocker missing from the cache is unknown. Only open questions count as depending on
 * another. Duplicates are left out; the loader has already turned links to them into links
 * to their canonical question.
 */
import { isDuplicate, type Question } from '.';

/** A question is central when it directly blocks at least this many open questions. */
export const CENTRAL_MIN_DEPENDENTS = 3;

/** Open and ready to ask, open and waiting on an unsettled blocker, or closed. */
export type Place = 'frontier' | 'blocked' | 'settled';

/** Independent questions are always peripheral too. */
export type Role = 'central' | 'peripheral' | 'independent';

export const ROLES: Role[] = ['central', 'peripheral', 'independent'];

/** One question's facts. */
export interface GraphQuestion {
  number: number;
  place: Place;
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
}

export function questionGraph(all: Question[]): QuestionGraph {
  const questions = all.filter((q) => !isDuplicate(q)).sort((a, b) => a.number - b.number);
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

  const records: Record<number, GraphQuestion> = {};
  for (const q of questions) {
    const open = q.status === 'open';
    const blockedBy = blockersOf(q);
    const place: Place = !open ? 'settled' : blockedBy.every(settled) ? 'frontier' : 'blocked';
    const mine = dependents.get(q.number)!;
    const has: Record<Role, boolean> = {
      central: open && mine.length >= CENTRAL_MIN_DEPENDENTS,
      peripheral: place === 'frontier' && mine.length === 0,
      independent: open && !linked.has(q.number),
    };
    records[q.number] = {
      number: q.number,
      place,
      blockedBy,
      dependents: mine,
      roles: ROLES.filter((r) => has[r]),
    };
  }
  return { questions: records };
}
