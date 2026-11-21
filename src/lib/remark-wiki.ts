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
import { SKIP, visit } from 'unist-util-visit';
import { wikiUrl } from './site';
import {
  calloutId,
  calloutKind,
  CALLOUTS,
  type CalloutKind,
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
}

const NUMERIC = /^[-−+]?(?:×\s?)?[\d.,]+\s?(?:%|×)?$/;

/** A wiki link as an mdast link node: existing pages carry `data-t`, missing ones are red. */
export function wikiLinkNode(inner: string, page?: string): PhrasingContent {
  const link = parseWikiLink(inner);
  const sectionId = link.section ? new GithubSlugger().slug(link.section) : undefined;
  const children: PhrasingContent[] = [{ type: 'text', value: link.label }];
  if (!link.target) {
    const url = page ? wikiUrl(page, sectionId) : `#${sectionId ?? ''}`;
    return { type: 'link', url, children };
  }
  const found = resolve(link.target);
  const node: Link = { type: 'link', url: wikiUrl(found.slug, sectionId), children };
  if (found.exists) {
    node.data = { hProperties: { dataT: found.slug } };
  } else {
    const name = found.title.charAt(0).toUpperCase() + found.title.slice(1);
    node.title = `${name} (page does not exist)`;
    node.data = { hProperties: { className: ['new'] } };
  }
  return node;
}

function splitText(node: Text, page?: string): PhrasingContent[] | undefined {
  if (!node.value.includes('[[')) return undefined;
  const out: PhrasingContent[] = [];
  let last = 0;
  for (const match of node.value.matchAll(WIKI_LINK)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ type: 'text', value: node.value.slice(last, at) });
    out.push(wikiLinkNode(match[1], page));
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

function transformLinks(tree: Root, page?: string): void {
  mergeText(tree);
  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index === undefined || parent.type === 'link') return;
    const parts = splitText(node, page);
    if (!parts) return;
    parent.children.splice(index, 1, ...(parts as RootContent[]));
    return [SKIP, index + parts.length];
  });
}

function transformCallouts(tree: Root): void {
  const counts: Record<CalloutKind, number> = { open: 0, conflict: 0 };
  visit(tree, 'blockquote', (node: Blockquote) => {
    const kind = calloutKind(node);
    if (!kind) return;
    counts[kind] += 1;
    stripCalloutMarker(node);
    node.children.unshift({
      type: 'paragraph',
      data: { hProperties: { className: ['note-h'] } },
      children: [{ type: 'strong', children: [{ type: 'text', value: CALLOUTS[kind].heading }] }],
    });
    node.data = {
      hName: 'div',
      hProperties: { className: ['note', `note-${kind}`], id: calloutId(kind, counts[kind]) },
    };
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

function contentsBox(tree: Root, headings: Heading[]): void {
  const h2s = headings.filter((h) => h.depth === 2);
  if (h2s.length < 3) return;
  const entries = [
    ...h2s.map((h) => ({ id: String(h.data?.hProperties?.id), text: toString(h) })),
    { id: 'links', text: 'What links here' },
  ];
  const toc = {
    type: 'wikiToc',
    data: { hName: 'div', hProperties: { className: ['toc'], id: 'toc', dataPagefindIgnore: '' } },
    children: [
      {
        type: 'wikiTocButton',
        data: { hName: 'button', hProperties: { type: 'button', ariaExpanded: 'true' } },
        children: [{ type: 'text', value: 'Contents' }],
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

/** Wiki links everywhere; for articles also callouts, `.wt` tables, heading ids and contents. */
export default function remarkWiki(options: RemarkWikiOptions = {}) {
  return (tree: Root) => {
    transformLinks(tree, options.page);
    if (!options.article) return;
    transformCallouts(tree);
    transformTables(tree);
    contentsBox(tree, addHeadingIds(tree));
  };
}
