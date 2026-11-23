/** What the scripts that change GitHub or the pages share: how they run. */

export interface RunOptions {
  live: boolean;
  /** The question cache a live run refreshes. */
  cache: string;
  log: (line: string) => void;
  /** Warnings and errors; `log` when absent. */
  warn?: (line: string) => void;
}

/** The closing line of a run that would make, or made, `changes` changes. */
export function summary(changes: number, live: boolean): string {
  if (!changes) return 'Nothing to change.';
  return live
    ? `Made ${changes} change(s).`
    : `Dry run: ${changes} change(s). Add --live to make them.`;
}
