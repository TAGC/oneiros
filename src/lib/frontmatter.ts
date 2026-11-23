/** The YAML frontmatter of a Markdown file: page files and the question cache. */
import { parse as parseYaml } from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface Frontmatter<T> {
  /** The parsed block; empty when the file has none. */
  data: T;
  /** The file after the block. */
  body: string;
  /** The file line the body starts on. */
  bodyLine: number;
}

/** Splits a file into its frontmatter and its body; the data is not checked against `T`. */
export function splitFrontmatter<T extends object = Record<string, unknown>>(
  raw: string,
): Frontmatter<T> {
  const match = FRONTMATTER.exec(raw);
  if (!match) return { data: {} as T, body: raw, bodyLine: 1 };
  const data = (parseYaml(match[1]) ?? {}) as T;
  return { data, body: raw.slice(match[0].length), bodyLine: match[0].split('\n').length };
}
