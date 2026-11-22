/**
 * The one-off migration of inline `[!OPEN]` and `[!CONFLICT]` callouts to question issues
 * (issue #7): parsing pages, pairing English and Chinese callouts, and building issues.
 * Pure: `scripts/migrate-callouts.ts` does the file and GitHub work.
 */
import type { Blockquote, Heading, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { AREAS } from '../areas';
import { SITE, slugify, wikiUrl } from '../site';
import { type CalloutKind, calloutKind, issueMarker, plainText } from '../wiki';

interface Located {
  /** Offsets of the blockquote in the raw file, frontmatter included. */
  start: number;
  end: number;
  /** The nearest heading above, as plain text. */
  section?: string;
}

export type Item =
  | (Located & { type: 'callout'; kind: CalloutKind; text: string })
  | (Located & { type: 'marker'; issue: number });

const parser = unified().use(remarkParse).use(remarkGfm);
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const CALLOUT_MARKER = /^\s*\[!(OPEN|CONFLICT)\]\s*/i;

/** Every inline callout and `[!ISSUE N]` marker in a page, in document order. */
export function findCallouts(raw: string): Item[] {
  const offset = FRONTMATTER.exec(raw)?.[0].length ?? 0;
  const body = raw.slice(offset);
  const tree = parser.parse(body) as Root;
  const items: Item[] = [];
  let section: string | undefined;
  visit(tree, (node) => {
    if (node.type === 'heading') {
      section = plainText(toString(node as Heading)).trim();
      return;
    }
    if (node.type !== 'blockquote') return;
    const quote = node as Blockquote;
    const from = quote.position?.start.offset ?? 0;
    const to = quote.position?.end.offset ?? from;
    const located: Located = { start: offset + from, end: offset + to };
    if (section) located.section = section;
    const issue = issueMarker(quote);
    if (issue !== undefined) {
      items.push({ ...located, type: 'marker', issue });
      return 'skip';
    }
    const kind = calloutKind(quote);
    if (!kind) return;
    const text = body
      .slice(from, to)
      .split('\n')
      .map((line) => line.replace(/^\s*>\s?/, ''))
      .join('\n')
      .replace(CALLOUT_MARKER, '')
      .trim();
    items.push({ ...located, type: 'callout', kind, text });
    return 'skip';
  });
  return items;
}

/** An English item and its Chinese twin, `index` counting from 1 in page order. */
export interface Pair {
  slug: string;
  index: number;
  en: Item;
  zh: Item;
}

/**
 * Pairs a page's English and Chinese callouts and markers by order. Any mismatch is a
 * problem and the page pairs nothing: the migration stops rather than guess.
 */
export function pairPage(
  slug: string,
  enRaw: string | undefined,
  zhRaw: string | undefined,
): { pairs: Pair[]; problems: string[] } {
  const en = enRaw === undefined ? [] : findCallouts(enRaw);
  const zh = zhRaw === undefined ? [] : findCallouts(zhRaw);
  if (enRaw === undefined && zh.length > 0) {
    return {
      pairs: [],
      problems: [`${slug}: no English page, Chinese has ${zh.length} callouts or markers`],
    };
  }
  if (zhRaw === undefined && en.length > 0) {
    return {
      pairs: [],
      problems: [`${slug}: no Chinese page, English has ${en.length} callouts or markers`],
    };
  }
  if (en.length !== zh.length) {
    return {
      pairs: [],
      problems: [`${slug}: English has ${en.length} callouts or markers, Chinese has ${zh.length}`],
    };
  }
  const problems: string[] = [];
  const pairs = en.map((item, i): Pair => ({ slug, index: i + 1, en: item, zh: zh[i] }));
  for (const { index, en: a, zh: b } of pairs) {
    if (a.type === 'callout' && b.type === 'callout' && a.kind !== b.kind) {
      problems.push(`${slug}: callout ${index} is ${a.kind} in English but ${b.kind} in Chinese`);
    }
    if (a.type === 'marker' && b.type === 'marker' && a.issue !== b.issue) {
      problems.push(
        `${slug}: item ${index} is issue ${a.issue} in English but issue ${b.issue} in Chinese`,
      );
    }
  }
  return problems.length ? { pairs: [], problems } : { pairs, problems };
}

/** Non-page sources a conflict can name, and the words that mention them. */
const SOURCE_WORDS: [source: string, pattern: RegExp][] = [
  ['vision', /\bvision\b/i],
  // The old reference sheet's Glossary tab, which conflicts call "the Glossary".
  ['sheet', /\b(sheet|Glossary)\b/],
];

/** The sources a conflict's text names, in the order it first mentions them. */
export function conflictSources(text: string): string[] {
  return SOURCE_WORDS.map(([source, pattern]) => ({ source, at: pattern.exec(text)?.index }))
    .filter((s): s is { source: string; at: number } => s.at !== undefined)
    .sort((a, b) => a.at - b.at)
    .map((s) => s.source);
}

export interface IssueInput {
  slug: string;
  pageTitle: string;
  area: string;
  index: number;
  kind: CalloutKind;
  section?: string;
  sources?: string[];
  raised?: string;
  title: { en: string; zh: string };
  text: { en: string; zh: string };
}

export interface PlannedIssue {
  title: string;
  body: string;
  labels: string[];
}

const KEY = /<!--\s*migrated-callout:\s*(\S+?)\s*-->/;

/** The `slug#index` of the callout an issue was migrated from, if it was. */
export function migrationKey(body: string): string | undefined {
  return KEY.exec(body)?.[1];
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/** One question issue in the agreed format, for a paired English and Chinese callout. */
export function buildIssue(input: IssueInput): PlannedIssue {
  if (!(AREAS as readonly string[]).includes(input.area)) {
    throw new Error(`${input.slug}: area ${input.area} is not one of the wiki's areas`);
  }
  const rows: [string, string][] = [
    ['Page', `[${input.pageTitle}](${SITE}${wikiUrl(input.slug)})`],
  ];
  if (input.section) rows.push(['Section', input.section]);
  if (input.sources?.length) rows.push(['Source', input.sources.join(', ')]);
  if (input.raised) rows.push(['Raised', input.raised]);
  const body = [
    `<!-- migrated-callout: ${input.slug}#${input.index} -->`,
    '',
    '| Property | Value |',
    '|---|---|',
    ...rows.map(([name, value]) => `| ${name} | ${cell(value)} |`),
    '',
    '## en',
    '',
    input.text.en,
    '',
    '## zh',
    '',
    `### ${input.title.zh}`,
    '',
    input.text.zh,
    '',
  ].join('\n');
  return {
    title: input.title.en,
    body,
    labels: [`kind:${input.kind}`, `area:${slugify(input.area)}`],
  };
}

/** The page with one callout swapped for its `[!ISSUE N]` marker. */
export function replaceWithMarker(raw: string, item: Item, issue: number): string {
  return `${raw.slice(0, item.start)}> [!ISSUE ${issue}]${raw.slice(item.end)}`;
}

export interface LabelSpec {
  name: string;
  color: string;
  description: string;
}

/** Labels the question issues use: GitHub colours are hex without the `#`. */
export const LABELS: LabelSpec[] = [
  { name: 'kind:open', color: '5b6ee1', description: 'An open question for the designer' },
  {
    name: 'kind:conflict',
    color: 'd9534f',
    description: 'Sources disagree; the designer settles which holds',
  },
  ...AREAS.map((area) => ({
    name: `area:${slugify(area)}`,
    color: 'c5b7e8',
    description: `Questions in the wiki's ${area} area`,
  })),
];
