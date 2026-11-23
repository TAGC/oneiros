/** What the scripts that change GitHub or the pages share: how they run. */

export interface RunOptions {
  live: boolean;
  /** The question cache a live run refreshes. */
  cache: string;
  log: (line: string) => void;
  /** Warnings and errors; `log` when absent. */
  warn?: (line: string) => void;
}
