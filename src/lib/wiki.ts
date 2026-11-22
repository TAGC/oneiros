import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Blockquote, Paragraph, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_LOCALE, type Locale, useTranslations } from '../i18n/ui';
import { getQuestions, type Question, type Questions } from './questions';
import { slugify, WIKI_DIRS } from './site';
import type { Status } from './status';

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
  /** The locale of the page found; a zh link falls back to the English page. */
  locale: Locale;
}

export type CalloutKind = 'open' | 'conflict';

export interface Callout {
  kind: CalloutKind;
  id: string;
  markdown: string;
  /** The question issue behind the `[!ISSUE N]` marker. */
  issue: number;
}

/** Callout kinds and the automatic category each adds (an English name, as are all categories). */
export const CALLOUTS: Record<CalloutKind, { category: string }> = {
  open: { category: 'Pages with open questions' },
  conflict: { category: 'Pages with conflicts' },
};

/** A callout box's header. A conflict question names the sources in its Source row. */
export function calloutHeading(kind: CalloutKind, locale: Locale, question?: Question): string {
  const t = useTranslations(locale);
  if (kind === 'open') return t.openQuestion;
  const sources = question?.properties.sources ?? [];
  if (sources.length < 2) return t.conflictBare;
  return t.conflictBetween(sources.map((s) => sourceName(s, locale) ?? s));
}

/**
 * A conflict source's name in a locale: a `[[wiki link]]` gives its page's title in that
 * locale, any other source must be one of the listed non-page sources. Undefined otherwise,
 * including a link whose page has no version in the locale.
 */
export function sourceName(source: string, locale: Locale): string | undefined {
  const link = /^\[\[([^[\]\n]+?)\]\]$/.exec(source.trim());
  if (!link) return useTranslations(locale).conflictSources[source.trim().toLowerCase()];
  const found = resolve(parseWikiLink(link[1]).target, locale);
  return found.exists && found.locale === locale ? found.title : undefined;
}

/** A category's display name: automatic categories and areas are translated, others are names. */
export function categoryLabel(name: string, locale: Locale): string {
  const t = useTranslations(locale);
  if (name === CALLOUTS.open.category) return t.categoryOpen;
  if (name === CALLOUTS.conflict.category) return t.categoryConflict;
  return t.areaNames[name] ?? name;
}

/** A page status's display name; frontmatter keeps the English name. */
export function statusLabel(status: Status, locale: Locale): string {
  return useTranslations(locale).statusNames[status];
}

export const WIKI_LINK = /\[\[([^[\]\n]+?)\]\]/g;
const MARKER = /^\s*\[!(OPEN|CONFLICT)\]\s*/i;
const ISSUE_MARKER = /^\s*\[!ISSUE\s+#?(\d+)\]/i;

interface Index {
  sources: WikiSource[];
  bySlug: Map<string, WikiSource>;
  byName: Map<string, WikiSource>;
}

const cache = new Map<Locale, { signature: string; index: Index }>();

/** A build reads each folder once; dev re-checks file times so edits show up live. */
const BUILD = process.env.NODE_ENV === 'production';

function wikiDir(locale: Locale): string {
  return join(process.cwd(), WIKI_DIRS[locale]);
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

function readIndex(locale: Locale): Index {
  const cached = cache.get(locale);
  if (BUILD && cached) return cached.index;
  const dir = wikiDir(locale);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));
  } catch {
    files = [];
  }
  const signature = files
    .map((f) => `${f}:${statSync(join(dir, f)).mtimeMs}`)
    .sort()
    .join('|');
  if (cached?.signature === signature) return cached.index;

  const sources = files.map((file): WikiSource => {
    const raw = readFileSync(join(dir, file), 'utf8');
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
  cache.set(locale, { signature, index });
  return index;
}

export function allSources(locale: Locale = 'en'): WikiSource[] {
  return readIndex(locale).sources;
}

export function sourceBySlug(slug: string, locale: Locale = 'en'): WikiSource | undefined {
  return readIndex(locale).bySlug.get(slug);
}

/**
 * Finds a page by title or alias, ignoring case; a missing page gets its would-be slug.
 * In zh, Chinese titles and aliases are tried first, then English ones.
 */
export function resolve(target: string, locale: Locale = 'en'): Resolved {
  const slug = slugify(target);
  for (const l of locale === 'en' ? (['en'] as const) : [locale, 'en' as const]) {
    const index = readIndex(l);
    const found = index.byName.get(nameKey(target)) ?? index.bySlug.get(slug);
    if (found) return { slug: found.slug, exists: true, title: found.title, locale: l };
  }
  return {
    slug: slug || encodeURIComponent(target.trim()),
    exists: false,
    title: target.trim(),
    locale,
  };
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
export function outgoingSlugs(source: WikiSource, locale: Locale = 'en'): Set<string> {
  const out = new Set<string>();
  for (const text of [source.body, ...source.infoboxValues]) {
    for (const match of text.matchAll(WIKI_LINK)) {
      const { target } = parseWikiLink(match[1]);
      if (target) out.add(resolve(target, locale).slug);
    }
  }
  out.delete(source.slug);
  return out;
}

const linksTo = new Map<Locale, { indexes: Index[]; bySlug: Map<string, WikiSource[]> }>();

/** Pages of one locale linking to `slug`, A to Z by title. */
export function backlinks(slug: string, locale: Locale = 'en'): WikiSource[] {
  const indexes = [readIndex(locale), ...(locale === 'en' ? [] : [readIndex('en')])];
  let cached = linksTo.get(locale);
  if (!cached || cached.indexes.some((index, i) => index !== indexes[i])) {
    const bySlug = new Map<string, WikiSource[]>();
    const sorted = [...indexes[0].sources].sort((a, b) =>
      a.title.localeCompare(b.title, locale === 'zh' ? 'zh-Hans' : undefined),
    );
    for (const source of sorted) {
      for (const target of outgoingSlugs(source, locale)) {
        const list = bySlug.get(target);
        if (list) list.push(source);
        else bySlug.set(target, [source]);
      }
    }
    cached = { indexes, bySlug };
    linksTo.set(locale, cached);
  }
  return [...(cached.bySlug.get(slug) ?? [])];
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

/** The issue number of a blockquote opening with `[!ISSUE 142]`, a question marker, if any. */
export function issueMarker(node: Blockquote): number | undefined {
  const first = node.children[0];
  if (first?.type !== 'paragraph') return undefined;
  const text = (first as Paragraph).children[0];
  if (text?.type !== 'text') return undefined;
  const match = ISSUE_MARKER.exec(text.value);
  return match ? Number(match[1]) : undefined;
}

/** The anchor id of a question marker's box. */
export function issueId(n: number): string {
  return `issue-${n}`;
}

/** The callout a `[!ISSUE N]` marker stands for; a missing question says so in its text. */
export function markerCallout(issue: number, locale: Locale, questions: Questions): Callout {
  const question = questions.get(issue);
  const markdown = question
    ? (question.text[locale] ?? question.text[DEFAULT_LOCALE] ?? '')
    : useTranslations(locale).questionMissing(issue);
  return { kind: question?.kind ?? 'open', id: issueId(issue), markdown, issue };
}

const calloutParser = unified().use(remarkParse).use(remarkGfm);

/**
 * Every question marker in a body, in document order, as a callout with its Markdown and
 * anchor id, its kind and text (in the page's locale) taken from its question.
 */
export function extractCallouts(
  body: string,
  locale: Locale = DEFAULT_LOCALE,
  questions: Questions = getQuestions(),
): Callout[] {
  const tree = calloutParser.parse(body) as Root;
  const callouts: Callout[] = [];
  visit(tree, 'blockquote', (node: Blockquote) => {
    const issue = issueMarker(node);
    if (issue !== undefined) callouts.push(markerCallout(issue, locale, questions));
  });
  return callouts;
}

/** Strips wiki-link syntax to its labels, for plain-text uses such as previews. */
export function plainText(text: string): string {
  return text.replace(WIKI_LINK, (_, inner: string) => parseWikiLink(inner).label);
}
