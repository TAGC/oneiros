/**
 * Content checks over the built site (`dist/`) and the sources. Run `bun run build` first.
 * Usage: bun scripts/check.ts. Exits 1 if any check fails.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Blockquote, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import type { Locale } from '../src/i18n/ui';
import { BASE, WIKI_DIRS } from '../src/lib/site';
import type { MarkedPage, Problem } from '../src/lib/questions/problems';
import type { CalloutKind } from '../src/lib/wiki';

// Production mode makes the wiki index read each folder once instead of re-checking file times.
process.env.NODE_ENV = 'production';
const { calloutKind, issueMarker, WIKI_LINK } = await import('../src/lib/wiki');
const { getQuestions } = await import('../src/lib/questions');
const { issueProblems, markerProblems } = await import('../src/lib/questions/problems');
const { constellationProblems, getConstellations } =
  await import('../src/lib/questions/constellations');
const { wikiLinkNode } = await import('../src/lib/remark-wiki');

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const SHEET = { en: 'src/data/sheet', zh: 'src/data/sheet-zh' };
const REDLINKS = 'src/data/redlinks.json';
const FORBIDDEN = 'src/i18n/zh-forbidden.json';

// ---------------------------------------------------------------- helpers

function files(dir: string, test: (name: string) => boolean): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true, encoding: 'utf8' })
    .filter(test)
    .sort()
    .map((f) => join(dir, f));
}

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const isPage = (f: string) => /\.mdx?$/.test(f);

function frontmatter(raw: string): { data: Record<string, unknown>; bodyLine: number } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, bodyLine: 1 };
  const data = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  return { data, bodyLine: match[0].split('\n').length };
}

function lineOf(raw: string, pattern: RegExp): number | undefined {
  const at = raw.split('\n').findIndex((l) => pattern.test(l));
  return at === -1 ? undefined : at + 1;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

function decodeFragment(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

// ---------------------------------------------------------------- the built site

interface Anchor {
  href: string;
  classes: string[];
  text: string;
}

interface HtmlPage {
  ids: Set<string>;
  anchors: Anchor[];
}

const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function attributes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of source.matchAll(ATTR)) {
    out.set(m[1].toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return out;
}

/** A small scanner for Astro's output: ids and links, ignoring scripts, styles and comments. */
function scanHtml(html: string): HtmlPage {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const ids = new Set<string>();
  const anchors: Anchor[] = [];
  for (const m of clean.matchAll(/<([a-z][\w-]*)(\s[^>]*)?>/gi)) {
    const attrs = attributes(m[2] ?? '');
    const id = attrs.get('id');
    if (id) ids.add(id);
    if (m[1].toLowerCase() !== 'a') continue;
    if (attrs.has('name')) ids.add(attrs.get('name') as string);
    const href = attrs.get('href');
    if (href === undefined) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = clean.indexOf('</a>', start);
    const text = decodeEntities(
      clean.slice(start, end === -1 ? start : end).replace(/<[^>]*>/g, ''),
    )
      .replace(/\s+/g, ' ')
      .trim();
    anchors.push({ href, classes: (attrs.get('class') ?? '').split(/\s+/), text });
  }
  return { ids, anchors };
}

/** Site path of a built file: `dist/wiki/echo/index.html` is `/oneiros/wiki/echo/`. */
function sitePath(file: string): string {
  return `${BASE}/${file.replace(/(^|\/)index\.html$/, '$1')}`;
}

/** The built file a site path is served from, if it is inside the site. */
function builtFile(pathname: string): string | undefined {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return undefined;
  const rest = decodeFragment(pathname.slice(BASE.length + 1));
  if (rest === '' || rest.endsWith('/')) return `${rest}index.html`;
  if (/\.[a-z0-9]+$/i.test(rest)) return rest;
  return existsSync(join(DIST, rest, 'index.html')) ? `${rest}/index.html` : `${rest}.html`;
}

const pages = new Map<string, HtmlPage>();

function loadSite(): void {
  for (const file of readdirSync(DIST, { recursive: true, encoding: 'utf8' })) {
    if (file.endsWith('.html')) pages.set(file, scanHtml(readFileSync(join(DIST, file), 'utf8')));
  }
}

/** Where in the sources a site URL is written as a wiki link: `file:line` strings. */
let linkIndex: Map<string, string[]> | undefined;

function sourcesLinkingTo(url: string): string[] {
  if (!linkIndex) {
    linkIndex = new Map();
    const add = (key: string, where: string) => {
      const list = linkIndex!.get(key) ?? [];
      if (!list.includes(where)) list.push(where);
      linkIndex!.set(key, list);
    };
    for (const locale of ['en', 'zh'] as Locale[]) {
      for (const file of files(WIKI_DIRS[locale], isPage)) {
        const slug = file.replace(/^.*\/|\.mdx?$/g, '');
        read(file)
          .split('\n')
          .forEach((line, i) => {
            for (const m of line.matchAll(WIKI_LINK)) {
              for (const page of [undefined, slug]) {
                const node = wikiLinkNode(m[1], page, locale) as { url: string };
                add(node.url, `${file}:${i + 1}`);
              }
            }
          });
      }
    }
  }
  return linkIndex.get(url) ?? [];
}

function listPages(from: string[], max = 3): string {
  const shown = from.slice(0, max).map(sitePath).join(', ');
  return from.length > max ? `${shown} and ${from.length - max} more` : shown;
}

function checkSectionLinks(): Problem[] {
  const broken = new Map<string, { reason: string; from: string[] }>();
  for (const [file, page] of pages) {
    const base = new URL(sitePath(file), 'https://site.invalid');
    for (const a of page.anchors) {
      if (a.classes.includes('new')) continue;
      const target = new URL(a.href, base);
      if (target.origin !== base.origin) continue;
      const built = builtFile(target.pathname);
      if (!built) continue;
      let reason: string | undefined;
      const targetPage = pages.get(built);
      if (!targetPage && !existsSync(join(DIST, built))) {
        reason = `no page at ${target.pathname}`;
      } else if (target.hash.length > 1 && targetPage) {
        const id = decodeFragment(target.hash.slice(1));
        if (id !== 'top' && !targetPage.ids.has(id)) {
          reason = `no id "${id}" on ${target.pathname}`;
        }
      }
      if (!reason) continue;
      const key = target.pathname + target.hash;
      const entry = broken.get(key) ?? { reason, from: [] };
      if (!entry.from.includes(file)) entry.from.push(file);
      broken.set(key, entry);
    }
  }
  const problems: Problem[] = [];
  for (const [url, { reason, from }] of broken) {
    const sources = sourcesLinkingTo(url);
    problems.push({
      where: sources.length ? sources.join(', ') : listPages(from),
      message: reason,
      detail: [`linked from ${listPages(from)}`],
    });
  }
  return problems;
}

function checkRedLinks(): Problem[] {
  const allowed = JSON.parse(read(REDLINKS)) as Record<string, string>;
  const seen = new Map<string, string[]>();
  for (const [file, page] of pages) {
    for (const a of page.anchors) {
      if (!a.classes.includes('new')) continue;
      const pathname = new URL(a.href, 'https://site.invalid').pathname;
      const slug = decodeFragment(/\/wiki\/([^/]+)\/?$/.exec(pathname)?.[1] ?? pathname);
      const list = seen.get(slug) ?? [];
      if (!list.includes(file)) list.push(file);
      seen.set(slug, list);
    }
  }
  const problems: Problem[] = [];
  for (const [slug, from] of seen) {
    if (slug in allowed) continue;
    const hrefs = [`${BASE}/wiki/${slug}/`, `${BASE}/zh/wiki/${encodeURIComponent(slug)}/`];
    const sources = hrefs.flatMap(sourcesLinkingTo);
    problems.push({
      where: sources.length ? sources.join(', ') : listPages(from),
      message: `red link to "${slug}", which has no page and is not in ${REDLINKS}`,
      detail: [`shown on ${listPages(from)}`],
    });
  }
  for (const slug of Object.keys(allowed)) {
    const written = ['.md', '.mdx'].some((ext) => existsSync(join(ROOT, WIKI_DIRS.en, slug + ext)));
    if (written) {
      problems.push({
        where: REDLINKS,
        message: `"${slug}" now has a page; remove it from the allowlist`,
      });
    } else if (!seen.has(slug)) {
      problems.push({
        where: REDLINKS,
        message: `nothing links to "${slug}" any more; remove it from the allowlist`,
      });
    }
  }
  return problems;
}

// ---------------------------------------------------------------- English style

function checkEnglishStyle(): Problem[] {
  const targets = [
    ...files(WIKI_DIRS.en, isPage),
    ...files(SHEET.en, (f) => f.endsWith('.json')),
    'README.md',
  ];
  const problems: Problem[] = [];
  for (const file of targets) {
    read(file)
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(/—|(?<=^|\s)–(?=\s|$)/g)) {
          const col = (m.index ?? 0) + 1;
          const what = m[0] === '—' ? 'em dash' : 'spaced en dash used as a dash';
          const from = Math.max(0, col - 30);
          problems.push({
            where: `${file}:${i + 1}:${col}`,
            message: `${what}: "${line.slice(from, col + 30).trim()}"`,
          });
        }
      });
  }
  return problems;
}

// ---------------------------------------------------------------- Chinese parity

const calloutParser = unified().use(remarkParse).use(remarkGfm);

function callouts(raw: string): Record<CalloutKind, number[]> {
  const { bodyLine } = frontmatter(raw);
  const body = raw
    .split('\n')
    .slice(bodyLine - 1)
    .join('\n');
  const out: Record<CalloutKind, number[]> = { open: [], conflict: [] };
  visit(calloutParser.parse(body) as Root, 'blockquote', (node: Blockquote) => {
    const kind = calloutKind(node);
    if (kind) out[kind].push((node.position?.start.line ?? 1) + bodyLine - 1);
  });
  return out;
}

// ---------------------------------------------------------------- question markers

function markers(raw: string): { issue: number; line: number }[] {
  const { bodyLine } = frontmatter(raw);
  const body = raw
    .split('\n')
    .slice(bodyLine - 1)
    .join('\n');
  const out: { issue: number; line: number }[] = [];
  visit(calloutParser.parse(body) as Root, 'blockquote', (node: Blockquote) => {
    const issue = issueMarker(node);
    if (issue !== undefined)
      out.push({ issue, line: (node.position?.start.line ?? 1) + bodyLine - 1 });
  });
  return out;
}

/** Every page in both locales with its markers, for the question checks. */
function markedPages(): MarkedPage[] {
  return (['en', 'zh'] as const).flatMap((locale) =>
    files(WIKI_DIRS[locale], isPage).map((file) => {
      const raw = read(file);
      return {
        file,
        locale,
        slug: file.replace(/^.*\/|\.mdx?$/g, ''),
        status: frontmatter(raw).data.status,
        markers: markers(raw),
      };
    }),
  );
}

// ---------------------------------------------------------------- page status

/**
 * Certainty and Dogma need nothing open, so their pages may hold no open or conflict
 * callouts (markers are checked with the questions). A Chinese page carries the same status
 * as its English page.
 */
function checkStatus(): Problem[] {
  const problems: Problem[] = [];
  const english = new Map<string, unknown>();
  for (const locale of ['en', 'zh'] as const) {
    for (const file of files(WIKI_DIRS[locale], isPage)) {
      const raw = read(file);
      const { status } = frontmatter(raw).data;
      const slug = file.replace(/^.*\//, '').replace(/\.mdx?$/, '');
      if (locale === 'en') english.set(slug, status);
      else if (english.has(slug) && english.get(slug) !== status)
        problems.push({
          where: file,
          message: `status ${String(status)} differs from the English page's ${String(english.get(slug))}`,
        });
      if (status !== 'Certainty' && status !== 'Dogma') continue;
      const found = callouts(raw);
      for (const kind of ['open', 'conflict'] as const)
        for (const line of found[kind])
          problems.push({
            where: `${file}:${line}`,
            message: `${status} page holds ${kind === 'open' ? 'an open' : 'a conflict'} callout; resolve it or lower the status`,
          });
    }
  }
  return problems;
}

function checkPageParity(): Problem[] {
  const problems: Problem[] = [];
  const en = files(WIKI_DIRS.en, isPage);
  const zh = new Set(files(WIKI_DIRS.zh, isPage));
  const slugOf = (f: string) => f.replace(/^.*\/|\.mdx?$/g, '');
  const zhSlugs = new Map([...zh].map((f) => [slugOf(f), f]));
  for (const enFile of en) {
    const zhFile = enFile.replace(WIKI_DIRS.en, WIKI_DIRS.zh);
    if (!zh.has(zhFile)) {
      const other = zhSlugs.get(slugOf(enFile));
      problems.push({
        where: other ?? zhFile,
        message: other ? `extension differs from ${enFile}` : `missing Chinese page for ${enFile}`,
      });
      continue;
    }
    const enRaw = read(enFile);
    const zhRaw = read(zhFile);
    const enData = frontmatter(enRaw).data;
    const zhData = frontmatter(zhRaw).data;
    for (const key of ['kind', 'area', 'navbox']) {
      const want = enData[key];
      const got = zhData[key];
      if (JSON.stringify(want) === JSON.stringify(got)) continue;
      const line = lineOf(zhRaw, new RegExp(`^${key}:`)) ?? 1;
      problems.push({
        where: `${zhFile}:${line}`,
        message: `${key} is ${JSON.stringify(got) ?? 'missing'}, English has ${JSON.stringify(want) ?? 'none'}`,
      });
    }
    const enCallouts = callouts(enRaw);
    const zhCallouts = callouts(zhRaw);
    for (const kind of ['open', 'conflict'] as CalloutKind[]) {
      const a = enCallouts[kind];
      const b = zhCallouts[kind];
      if (a.length === b.length) continue;
      const marker = kind === 'open' ? '[!OPEN]' : '[!CONFLICT]';
      problems.push({
        where: zhFile,
        message: `${b.length} ${marker} callouts, English has ${a.length}`,
        detail: [
          `English at lines ${a.join(', ') || 'none'} of ${enFile}`,
          `Chinese at lines ${b.join(', ') || 'none'}`,
        ],
      });
    }
  }
  const enSlugs = new Set(en.map(slugOf));
  for (const zhFile of zh) {
    if (!enSlugs.has(slugOf(zhFile))) {
      problems.push({ where: zhFile, message: 'no English page with this file name' });
    }
  }
  return problems;
}

interface SheetJson {
  name?: string;
  blocks: (
    | { type: 'table'; header: unknown[]; rows: unknown[][] }
    | { type: 'notes'; items: unknown[] }
  )[];
}

function checkSheetParity(): Problem[] {
  const problems: Problem[] = [];
  for (const zhFile of files(SHEET.zh, (f) => f.endsWith('.json'))) {
    const enFile = zhFile.replace(SHEET.zh, SHEET.en);
    if (!existsSync(join(ROOT, enFile))) {
      problems.push({ where: zhFile, message: `no English tab ${enFile}` });
      continue;
    }
    const en = JSON.parse(read(enFile)) as SheetJson;
    const zh = JSON.parse(read(zhFile)) as SheetJson;
    const report = (message: string) => problems.push({ where: zhFile, message });
    if (zh.blocks.length !== en.blocks.length) {
      report(`${zh.blocks.length} blocks, English has ${en.blocks.length}`);
    }
    en.blocks.forEach((enBlock, b) => {
      const zhBlock = zh.blocks[b];
      if (!zhBlock) return;
      if (zhBlock.type !== enBlock.type) {
        report(`block ${b + 1} is ${zhBlock.type}, English is ${enBlock.type}`);
        return;
      }
      if (enBlock.type === 'notes' && zhBlock.type === 'notes') {
        if (zhBlock.items.length !== enBlock.items.length) {
          report(
            `block ${b + 1} has ${zhBlock.items.length} notes, English has ${enBlock.items.length}`,
          );
        }
        return;
      }
      if (enBlock.type !== 'table' || zhBlock.type !== 'table') return;
      if (zhBlock.header.length !== enBlock.header.length) {
        report(
          `block ${b + 1} header has ${zhBlock.header.length} cells, English has ${enBlock.header.length}`,
        );
      }
      if (zhBlock.rows.length !== enBlock.rows.length) {
        report(
          `block ${b + 1} has ${zhBlock.rows.length} rows, English has ${enBlock.rows.length}`,
        );
      }
      enBlock.rows.forEach((row, r) => {
        const zhRow = zhBlock.rows[r];
        if (zhRow && zhRow.length !== row.length) {
          report(
            `block ${b + 1} row ${r + 1} has ${zhRow.length} cells, English has ${row.length} (English row starts "${String(row[0] ?? '')}")`,
          );
        }
      });
    });
  }
  return problems;
}

// ---------------------------------------------------------------- Chinese terms

interface ForbiddenTerm {
  term: string;
  preferred: string;
  note?: string;
  allow?: string[];
}

/** True if the match at `at` sits inside one of the allowed longer strings. */
function allowedAt(line: string, at: number, term: string, allow: string[]): boolean {
  return allow.some((context) => {
    for (let k = context.indexOf(term); k !== -1; k = context.indexOf(term, k + 1)) {
      if (at - k >= 0 && line.startsWith(context, at - k)) return true;
    }
    return false;
  });
}

function checkChineseTerms(): Problem[] {
  const { terms } = JSON.parse(read(FORBIDDEN)) as { terms: ForbiddenTerm[] };
  const targets = [...files(WIKI_DIRS.zh, isPage), ...files(SHEET.zh, (f) => f.endsWith('.json'))];
  const problems: Problem[] = [];
  for (const file of targets) {
    read(file)
      .split('\n')
      .forEach((line, i) => {
        for (const entry of terms) {
          for (
            let at = line.indexOf(entry.term);
            at !== -1;
            at = line.indexOf(entry.term, at + 1)
          ) {
            if (allowedAt(line, at, entry.term, entry.allow ?? [])) continue;
            const note = entry.note ? `; ${entry.note}` : '';
            problems.push({
              where: `${file}:${i + 1}:${at + 1}`,
              message: `${entry.term}: use ${entry.preferred}${note}`,
              detail: [`"${line.slice(Math.max(0, at - 12), at + entry.term.length + 12).trim()}"`],
            });
          }
        }
      });
  }
  return problems;
}

// ---------------------------------------------------------------- runner

const CHECKS: [string, () => Problem[] | Promise<Problem[]>][] = [
  ['Section links', checkSectionLinks],
  ['Red links', checkRedLinks],
  ['English style', checkEnglishStyle],
  ['Chinese page parity', checkPageParity],
  ['Chinese sheet parity', checkSheetParity],
  ['Chinese terms', checkChineseTerms],
  ['Page status', checkStatus],
  ['Question markers', () => markerProblems(getQuestions(), markedPages())],
  ['Question issues', () => issueProblems(getQuestions())],
  ['Constellations', () => constellationProblems(getConstellations())],
];

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ is missing: run `bun run build` first.');
  process.exit(1);
}

const started = performance.now();
loadSite();
const loaded = performance.now();
console.log(`Read ${pages.size} built pages in ${Math.round(loaded - started)} ms\n`);

let failures = 0;
for (const [name, run] of CHECKS) {
  const t = performance.now();
  const problems = await run();
  const ms = Math.round(performance.now() - t);
  failures += problems.length;
  const status = problems.length ? `FAIL (${problems.length})` : 'ok';
  console.log(`${name}: ${status}, ${ms} ms`);
  for (const p of problems) {
    console.log(`  ${p.where}: ${p.message}`);
    for (const d of p.detail ?? []) console.log(`      ${d}`);
  }
}

const total = Math.round(performance.now() - started);
console.log(`\n${failures ? `${failures} problem(s)` : 'All checks passed'} in ${total} ms`);
process.exit(failures ? 1 : 0);
