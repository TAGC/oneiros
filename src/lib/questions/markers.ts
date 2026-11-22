/**
 * Question markers (`> [!ISSUE N]`) on a page, read from its parsed Markdown. Rendering, the
 * page list and the checks all find markers here.
 */
import type { Blockquote, Paragraph, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { splitFrontmatter } from '../frontmatter';
import type { CalloutKind } from '../wiki';

/** A `> [!ISSUE N]` marker and the line it starts on. */
export interface Marker {
  issue: number;
  line: number;
}

/** An old inline `[!OPEN]` or `[!CONFLICT]` callout, which fails the checks. */
export interface OldCallout {
  kind: CalloutKind;
  line: number;
}

/** A quote that reads like a marker but is spelt or placed otherwise, which fails the checks. */
export interface Misspelt {
  /** Its first source line, as written. */
  found: string;
  /** The issue it seems to name, if any. */
  issue?: number;
  line: number;
}

export interface PageMarkers {
  /** In page order. */
  markers: Marker[];
  callouts: OldCallout[];
  misspelt: Misspelt[];
}

const EXACT = /^\[!ISSUE ([1-9]\d*)\]$/;
const LOOSE = /^\s*\[!\s*issue\b[^\]\d]*(\d+)?/i;
const OLD = /^\s*\[!(OPEN|CONFLICT)\]/i;

const parser = unified().use(remarkParse).use(remarkGfm);

/** The issue of a blockquote that is exactly a marker, if it is one. */
function exactIssue(node: Blockquote): number | undefined {
  if (node.children.length !== 1 || node.children[0].type !== 'paragraph') return undefined;
  const parts = (node.children[0] as Paragraph).children;
  if (parts.length !== 1 || parts[0].type !== 'text') return undefined;
  const match = EXACT.exec(parts[0].value);
  return match ? Number(match[1]) : undefined;
}

/** The opening text of a blockquote's first paragraph, if it opens with text. */
function openingText(node: Blockquote): string | undefined {
  const first = node.children[0];
  if (first?.type !== 'paragraph') return undefined;
  const text = (first as Paragraph).children[0];
  return text?.type === 'text' ? text.value : undefined;
}

/** The top-level blockquotes of a tree that are markers, in page order. */
export function markerBlocks(tree: Root): { issue: number; node: Blockquote }[] {
  return tree.children.flatMap((node) => {
    const issue = node.type === 'blockquote' ? exactIssue(node) : undefined;
    return issue === undefined ? [] : [{ issue, node: node as Blockquote }];
  });
}

/** A page file's markers, at their file lines; the frontmatter holds none. */
export function readMarkers(raw: string): PageMarkers {
  const { body, bodyLine } = splitFrontmatter(raw);
  return readBodyMarkers(body, bodyLine);
}

/**
 * A page body's markers, for a body already parted from its frontmatter; `firstLine` is the
 * file line the body starts on.
 */
export function readBodyMarkers(body: string, firstLine = 1): PageMarkers {
  const tree = parser.parse(body) as Root;
  const lines = body.split('\n');
  const start = (node: Blockquote) => node.position?.start.line ?? 1;
  const line = (node: Blockquote) => start(node) + firstLine - 1;
  const blocks = markerBlocks(tree);
  const exact = new Set(blocks.map((b) => b.node));
  const callouts: OldCallout[] = [];
  const misspelt: Misspelt[] = [];
  visit(tree, 'blockquote', (node: Blockquote) => {
    const text = openingText(node);
    if (exact.has(node) || text === undefined) return;
    const old = OLD.exec(text);
    if (old) callouts.push({ kind: old[1].toLowerCase() as CalloutKind, line: line(node) });
    const loose = LOOSE.exec(text);
    if (!loose) return;
    const found = (lines[start(node) - 1] ?? '').trim();
    const issue = loose[1] === undefined ? undefined : Number(loose[1]);
    misspelt.push({ found, ...(issue === undefined ? {} : { issue }), line: line(node) });
  });
  return {
    markers: blocks.map(({ issue, node }) => ({ issue, line: line(node) })),
    callouts,
    misspelt,
  };
}
