/**
 * Graph facts derived from the blocked-by links between questions, for the Astrolabe.
 * Every list holds open question numbers, sorted. A blocker counts as settled only when it
 * is decided or ruled out: an undermined decision stands on a broken premise, and a blocker
 * missing from the cache is unknown. Only open questions count as depending on another.
 * Duplicates are left out, so a duplicate blocker is unknown too.
 */
import { isDuplicate, type Question } from '.';

/** A question is central when it directly blocks at least this many open questions. */
export const CENTRAL_MIN_DEPENDENTS = 3;

/** Plain, JSON-safe data, so a page can hand it to client code as it is. */
export interface QuestionGraph {
  /** Open questions whose blockers are all settled: ready to ask next. */
  frontier: number[];
  /** Frontier questions that no open question depends on: quick, self-contained picks. */
  peripheral: number[];
  /**
   * Open questions with no links at all: no blocked-by or Undermined by edge in either
   * direction, to questions in any state. Every independent question is also peripheral.
   */
  independent: number[];
  /** Open questions that block at least `CENTRAL_MIN_DEPENDENTS` open questions directly. */
  central: number[];
  /** For every question, by number: the open questions it directly blocks, sorted. */
  dependents: Record<number, number[]>;
}

export function questionGraph(all: Question[]): QuestionGraph {
  const questions = all.filter((q) => !isDuplicate(q));
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  const settled = (n: number) => {
    const status = byNumber.get(n)?.status;
    return status === 'decided' || status === 'ruled-out';
  };
  const open = questions.filter((q) => q.status === 'open').sort((a, b) => a.number - b.number);

  const dependents: Record<number, number[]> = {};
  for (const q of questions) dependents[q.number] = [];
  for (const q of open) for (const b of q.blockedBy) dependents[b]?.push(q.number);
  const dependentCount = (n: number) => dependents[n]?.length ?? 0;

  const linked = new Set<number>();
  for (const q of questions) {
    for (const n of [...q.blockedBy, ...q.underminedBy]) linked.add(n);
    if (q.blockedBy.length || q.underminedBy.length) linked.add(q.number);
  }

  const numbers = open.map((q) => q.number);
  const frontier = open.filter((q) => q.blockedBy.every(settled)).map((q) => q.number);
  return {
    frontier,
    peripheral: frontier.filter((n) => dependentCount(n) === 0),
    independent: numbers.filter((n) => !linked.has(n)),
    central: numbers.filter((n) => dependentCount(n) >= CENTRAL_MIN_DEPENDENTS),
    dependents,
  };
}
