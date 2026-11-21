import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Blockquote, Paragraph, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import { slugify, WIKI_DIR } from './site';

/** A page as read straight from disk, independent of Astro's content layer. */
export interface WikiSource {
  slug: string;
  file: string;
  title: string;
  aliases: string[];
  summary: string;
  body: string;
  infoboxValues: string[];
}

export interface WikiLink {
  target: string;
  section?: string;
  label: string;
}

export interface Resolved {
  slug: string;
  exists: boolean;
  title: string;
}

export type CalloutKind = 'open' | 'conflict';

export interface Callout {
  kind: CalloutKind;
  id: string;
  markdown: string;
}

export const CALLOUTS: Record<CalloutKind, { heading: string; category: string }> = {
  open: { heading: 'Open question', category: 'Pages with open questions' },
  conflict: { heading: 'Conflict: vision and sheet disagree', category: 'Pages with conflicts' },
};

export const WIKI_LINK = /\[\[([^[\]\n]+?)\]\]/g;
const MARKER = /^\s*\[!(OPEN|CONFLICT)\]\s*/i;

interface Index {
  sources: WikiSource[];
  bySlug: Map<string, WikiSource>;
  byName: Map<string, WikiSource>;
}

let cache: { signature: string; index: Index } | undefined;

function wikiDir(): string {
  return join(process.cwd(), WIKI_DIR);
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  return { data, body: raw.slice(match[0].length) };
}

function nameKey(name: string): string {
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function readIndex(): Index {
  let files: string[] = [];
  try {
    files = readdirSync(wikiDir()).filter((f) => /\.mdx?$/.test(f));
  } catch {
    files = [];
  }
  const signature = files
    .map((f) => `${f}:${statSync(join(wikiDir(), f)).mtimeMs}`)
    .sort()
    .join('|');
  if (cache?.signature === signature) return cache.index;

  const sources = files.map((file): WikiSource => {
    const raw = readFileSync(join(wikiDir(), file), 'utf8');
    const { data, body } = splitFrontmatter(raw);
    const infobox = data.infobox as { rows?: { value?: unknown }[] } | undefined;
    return {
      slug: file.replace(/\.mdx?$/, ''),
      file,
      title: String(data.title ?? file),
      aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
      summary: String(data.summary ?? ''),
      body,
      infoboxValues: (infobox?.rows ?? []).map((row) => String(row.value ?? '')),
    };
  });
  const bySlug = new Map(sources.map((s) => [s.slug, s]));
  const byName = new Map<string, WikiSource>();
  for (const s of sources) {
    for (const name of [s.title, ...s.aliases]) {
      if (!byName.has(nameKey(name))) byName.set(nameKey(name), s);
    }
  }
  const index = { sources, bySlug, byName };
  cache = { signature, index };
  return index;
}

export function allSources(): WikiSource[] {
  return readIndex().sources;
}

export function sourceBySlug(slug: string): WikiSource | undefined {
  return readIndex().bySlug.get(slug);
}

/** Finds a page by title or alias, ignoring case; a missing page gets its would-be slug. */
export function resolve(target: string): Resolved {
  const index = readIndex();
  const found = index.byName.get(nameKey(target)) ?? index.bySlug.get(slugify(target));
  if (found) return { slug: found.slug, exists: true, title: found.title };
  return { slug: slugify(target), exists: false, title: target.trim() };
}

/** Splits the inside of `[[Target#Section|label]]`. */
export function parseWikiLink(inner: string): WikiLink {
  const pipe = inner.indexOf('|');
  const left = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
  const label = pipe === -1 ? '' : inner.slice(pipe + 1).trim();
  const hash = left.indexOf('#');
  const target = (hash === -1 ? left : left.slice(0, hash)).trim();
  const section = hash === -1 ? undefined : left.slice(hash + 1).trim() || undefined;
  const fallback = section ? (target ? `${target} § ${section}` : section) : target;
  return { target, section, label: label || fallback };
}

/** Every page slug a source links to through wiki links in its body or infobox. */
export function outgoingSlugs(source: WikiSource): Set<string> {
  const out = new Set<string>();
  for (const text of [source.body, ...source.infoboxValues]) {
    for (const match of text.matchAll(WIKI_LINK)) {
      const { target } = parseWikiLink(match[1]);
      if (target) out.add(resolve(target).slug);
    }
  }
  out.delete(source.slug);
  return out;
}

/** Slugs of existing pages linking to `slug`, A to Z by title. */
export function backlinks(slug: string): WikiSource[] {
  return allSources()
    .filter((s) => s.slug !== slug && outgoingSlugs(s).has(slug))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** The callout kind of a blockquote opening with `[!OPEN]` or `[!CONFLICT]`, if any. */
export function calloutKind(node: Blockquote): CalloutKind | undefined {
  const first = node.children[0];
  if (first?.type !== 'paragraph') return undefined;
  const text = (first as Paragraph).children[0];
  if (text?.type !== 'text') return undefined;
  const match = MARKER.exec(text.value);
  return match ? (match[1].toLowerCase() as CalloutKind) : undefined;
}

/** Removes the `[!KIND]` marker, dropping the opening paragraph if nothing else is in it. */
export function stripCalloutMarker(node: Blockquote): void {
  const first = node.children[0] as Paragraph;
  const text = first.children[0];
  if (text.type !== 'text') return;
  text.value = text.value.replace(MARKER, '');
  if (!text.value) first.children.shift();
  if (first.children.length === 0) node.children.shift();
}

export function calloutId(kind: CalloutKind, n: number): string {
  return `${kind}-${n}`;
}

/** Every callout in a body, in document order, with its Markdown and anchor id. */
export function extractCallouts(body: string): Callout[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
  const counts: Record<CalloutKind, number> = { open: 0, conflict: 0 };
  const callouts: Callout[] = [];
  visit(tree, 'blockquote', (node: Blockquote) => {
    const kind = calloutKind(node);
    if (!kind) return;
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? start;
    const markdown = body
      .slice(start, end)
      .split('\n')
      .map((line) => line.replace(/^\s*>\s?/, ''))
      .join('\n')
      .replace(MARKER, '');
    counts[kind] += 1;
    callouts.push({ kind, id: calloutId(kind, counts[kind]), markdown });
  });
  return callouts;
}

/** Strips wiki-link syntax to its labels, for plain-text uses such as previews. */
export function plainText(text: string): string {
  return text.replace(WIKI_LINK, (_, inner: string) => parseWikiLink(inner).label);
}
