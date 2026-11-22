/**
 * Graph facts derived from the blocked-by links between questions, for the Astrolabe.
 * Every list holds open question numbers, sorted. A blocker counts as settled only when it
 * is decided or ruled out: an undermined decision stands on a broken premise, and a blocker
 * missing from the cache is unknown. Only open questions count as depending on another.
 */
import type { Question } from '.';

export interface QuestionGraph {
  /** Open questions whose blockers are all settled: ready to ask next. */
  frontier: number[];
  /** Frontier questions that no open question depends on: quick, self-contained picks. */
  peripheral: number[];
}

export function questionGraph(questions: Question[]): QuestionGraph {
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  const settled = (n: number) => {
    const status = byNumber.get(n)?.status;
    return status === 'decided' || status === 'ruled-out';
  };
  const open = questions.filter((q) => q.status === 'open').sort((a, b) => a.number - b.number);
  const openDependents = new Map<number, number[]>();
  for (const q of open) {
    for (const b of q.blockedBy)
      openDependents.set(b, [...(openDependents.get(b) ?? []), q.number]);
  }
  const frontier = open.filter((q) => q.blockedBy.every(settled)).map((q) => q.number);
  const peripheral = frontier.filter((n) => !openDependents.has(n));
  return { frontier, peripheral };
}
