import type { Question } from '.';

/** Duplicates stand in for their canonical issue: lists, graphs and maps skip them. */
export function isDuplicate(question: Question): boolean {
  return question.status === 'duplicate';
}

/** The questions without duplicates, by number; a new array. */
export function withoutDuplicates(questions: Question[]): Question[] {
  return questions.filter((q) => !isDuplicate(q)).sort((a, b) => a.number - b.number);
}
