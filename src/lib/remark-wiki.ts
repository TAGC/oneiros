import GithubSlugger from 'github-slugger';
import type {
  Blockquote,
  Heading,
  Link,
  Parent,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  Text,
} from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { DEFAULT_LOCALE, type Locale, useTranslations } from '../i18n/ui';
import { getQuestions, type Questions } from './questions';
import { WIKI_DIRS, wikiUrl } from './site';
import {
  calloutHeading,
  calloutId,
  calloutKind,
  type CalloutKind,
  issueMarker,
  markerCallout,
  parseWikiLink,
  resolve,
  stripCalloutMarker,
  WIKI_LINK,
} from './wiki';

export interface RemarkWikiOptions {
  /** Also add heading ids, the contents box, callouts and table classes (full articles). */
  article?: boolean;
  /** The page slug that `[[#Section]]` links point into, when rendered off that page. */
  page?: string;
  /** The locale links resolve in; by default worked out from the file's folder. */
  locale?: Locale;
  /** Where `[!ISSUE N]` markers find their questions; by default the repo's question cache. */
  questions?: Questions;
  /** Unused here: puts `renderDigest()` into Astro's config so cached pages re-render. */
  digest?: string;
}

const NUMERIC = /^[-−+]?(?:×\s?)?[\d.,]+\s?(?:%|×)?$/;

/**
 * A wiki link as an mdast link node: existing pages carry `data-t`, missing ones are red.
 * On a zh page, a target with only an English page links there with the class `en`.
 */
export function wikiLinkNode(
  inner: string,
  page?: string,
  locale: Locale = DEFAULT_LOCALE,
): PhrasingContent {
  const link = parseWikiLink(inner);
  const sectionId = link.section ? new GithubSlugger().slug(link.section) : undefined;
  const children: PhrasingContent[] = [{ type: 'text', value: link.label }];
  if (!link.target) {
    const url = page ? wikiUrl(page, sectionId, locale) : `#${sectionId ?? ''}`;
    return { type: 'link', url, children };
  }
  const t = useTranslations(locale);
  const found = resolve(link.target, locale);
  const node: Link = { type: 'link', url: wikiUrl(found.slug, sectionId, found.locale), children };
  if (!found.exists) {
    const name = found.title.charAt(0).toUpperCase() + found.title.slice(1);
    node.title = t.pageMissing(name);
    node.data = { hProperties: { className: ['new'] } };
  } else if (found.locale !== locale) {
    node.title = t.englishOnly;
    node.data = { hProperties: { dataT: found.slug, className: ['en'], hrefLang: found.locale } };
  } else {
    node.data = { hProperties: { dataT: found.slug } };
  }
  return node;
}

/** The part of a VFile this plugin reads. */
interface SourceFile {
  path?: string;
  history: string[];
}

/** The locale of a content file, from the folder it sits in. */
export function fileLocale(file?: SourceFile): Locale {
  const path = String(file?.path ?? file?.history[0] ?? '').replaceAll('\\', '/');
  return path.includes(`/${WIKI_DIRS.zh}/`) ? 'zh' : DEFAULT_LOCALE;
}

function splitText(
  node: Text,
  page: string | undefined,
  locale: Locale,
): PhrasingContent[] | undefined {
  if (!node.value.includes('[[')) return undefined;
  const out: PhrasingContent[] = [];
  let last = 0;
  for (const match of node.value.matchAll(WIKI_LINK)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ type: 'text', value: node.value.slice(last, at) });
    out.push(wikiLinkNode(match[1], page, locale));
    last = at + match[0].length;
  }
  if (last === 0) return undefined;
  if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
  return out;
}

/** The parser can leave `[[x]]` across neighbouring text nodes; join them first. */
function mergeText(tree: Root): void {
  visit(tree, (node) => {
    if (!('children' in node)) return;
    const merged: RootContent[] = [];
    for (const child of (node as Parent).children) {
      const prev = merged.at(-1);
      if (child.type === 'text' && prev?.type === 'text') prev.value += child.value;
      else merged.push(child);
    }
    (node as Parent).children = merged;
  });
}

function transformLinks(tree: Root, page: string | undefined, locale: Locale): void {
  mergeText(tree);
  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index === undefined || parent.type === 'link') return;
    const parts = splitText(node, page, locale);
    if (!parts) return;
    parent.children.splice(index, 1, ...(parts as RootContent[]));
    return [SKIP, index + parts.length];
  });
}

/** Turns a blockquote into a callout box with its header. */
function toNote(node: Blockquote, kind: CalloutKind, id: string, locale: Locale): void {
  node.children.unshift({
    type: 'paragraph',
    data: { hProperties: { className: ['note-h'] } },
    children: [
      { type: 'strong', children: [{ type: 'text', value: calloutHeading(kind, locale) }] },
    ],
  });
  node.data = { hName: 'div', hProperties: { className: ['note', `note-${kind}`], id } };
}

const fragmentProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants);

function parseFragment(markdown: string): RootContent[] {
  const tree = fragmentProcessor.runSync(fragmentProcessor.parse(markdown)) as Root;
  visit(tree, (node) => {
    delete node.position;
  });
  return tree.children;
}

/** Fills each `[!ISSUE N]` marker with its question's text for the page's locale. */
function expandMarkers(tree: Root, locale: Locale, questions: Questions): void {
  visit(tree, 'blockquote', (node: Blockquote) => {
    const n = issueMarker(node);
    if (n === undefined) return;
    const callout = markerCallout(n, locale, questions);
    node.children = parseFragment(callout.markdown) as Blockquote['children'];
    toNote(node, callout.kind, callout.id, locale);
    return SKIP;
  });
}

function transformCallouts(tree: Root, locale: Locale): void {
  const counts: Record<CalloutKind, number> = { open: 0, conflict: 0 };
  visit(tree, 'blockquote', (node: Blockquote) => {
    if (node.data?.hName) return;
    const kind = calloutKind(node);
    if (!kind) return;
    counts[kind] += 1;
    stripCalloutMarker(node);
    toNote(node, kind, calloutId(kind, counts[kind]), locale);
  });
}

function transformTables(tree: Root): void {
  visit(tree, 'table', (node: Table, index, parent: Parent | undefined) => {
    node.data = { hProperties: { className: ['wt'] } };
    visit(node, 'tableCell', (cell: TableCell) => {
      if (NUMERIC.test(toString(cell).trim())) cell.data = { hProperties: { className: ['n'] } };
    });
    if (!parent || index === undefined) return;
    const wrap = {
      type: 'wikiTableWrap',
      data: { hName: 'div', hProperties: { className: ['wt-wrap'] } },
      children: [node],
    } as unknown as RootContent;
    parent.children.splice(index, 1, wrap);
    return SKIP;
  });
}

function addHeadingIds(tree: Root): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  visit(tree, 'heading', (node: Heading) => {
    const id = slugger.slug(toString(node));
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    headings.push(node);
  });
  return headings;
}

function contentsBox(tree: Root, headings: Heading[], locale: Locale): void {
  const t = useTranslations(locale);
  const h2s = headings.filter((h) => h.depth === 2);
  if (h2s.length < 3) return;
  const entries = [
    ...h2s.map((h) => ({ id: String(h.data?.hProperties?.id), text: toString(h) })),
    { id: 'links', text: t.whatLinksHere },
  ];
  const toc = {
    type: 'wikiToc',
    data: { hName: 'div', hProperties: { className: ['toc'], id: 'toc', dataPagefindIgnore: '' } },
    children: [
      {
        type: 'wikiTocButton',
        data: { hName: 'button', hProperties: { type: 'button', ariaExpanded: 'true' } },
        children: [{ type: 'text', value: t.contents }],
      },
      {
        type: 'list',
        ordered: true,
        spread: false,
        children: entries.map((e) => ({
          type: 'listItem',
          spread: false,
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'link', url: `#${e.id}`, children: [{ type: 'text', value: e.text }] },
              ],
            },
          ],
        })),
      },
    ],
  } as unknown as RootContent;
  const at = tree.children.indexOf(h2s[0]);
  if (at !== -1) tree.children.splice(at, 0, toc);
}

/** Wiki links everywhere; for articles also callouts and question markers, `.wt` tables, heading ids and contents. */
export default function remarkWiki(options: RemarkWikiOptions = {}) {
  return (tree: Root, file?: SourceFile) => {
    const locale = options.locale ?? fileLocale(file);
    if (options.article) expandMarkers(tree, locale, options.questions ?? getQuestions());
    transformLinks(tree, options.page, locale);
    if (!options.article) return;
    transformCallouts(tree, locale);
    transformTables(tree);
    contentsBox(tree, addHeadingIds(tree), locale);
  };
}
