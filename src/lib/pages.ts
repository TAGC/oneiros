import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { type CollectionEntry, getCollection } from 'astro:content';
import { DEFAULT_LOCALE, type Locale } from '../i18n/ui';
import { AREAS } from './areas';
import { slugify, WIKI_DIRS } from './site';
import { type Callout, CALLOUTS, extractCallouts, sourceBySlug } from './wiki';

export type Entry = CollectionEntry<'wiki'> | CollectionEntry<'wiki-zh'>;

export interface Page {
  entry: Entry;
  slug: string;
  file: string;
  title: string;
  categories: string[];
  callouts: Callout[];
  /** The language the page is written in; a zh list falls back to English pages. */
  locale: Locale;
  /** The English page's title, which orders zh lists until a Chinese ordering is chosen. */
  sortTitle: string;
}

const cache = new Map<Locale, Promise<Page[]>>();

function fileName(entry: Entry, locale: Locale): string {
  return (
    entry.filePath?.split('/').pop() ?? sourceBySlug(entry.id, locale)?.file ?? `${entry.id}.md`
  );
}

function toPage(entry: Entry, locale: Locale): Page {
  const callouts = extractCallouts(entry.body ?? '');
  const auto = (['open', 'conflict'] as const)
    .filter((kind) => callouts.some((c) => c.kind === kind))
    .map((kind) => CALLOUTS[kind].category);
  const categories = [...new Set([entry.data.area, ...(entry.data.categories ?? []), ...auto])];
  return {
    entry,
    slug: entry.id,
    file: fileName(entry, locale),
    title: entry.data.title,
    categories,
    callouts,
    locale,
    sortTitle: entry.data.title,
  };
}

async function load(locale: Locale): Promise<Page[]> {
  const english = (await getCollection('wiki')).map((entry) => toPage(entry, 'en'));
  if (locale === DEFAULT_LOCALE) return english.sort((a, b) => a.title.localeCompare(b.title));
  const translated = new Map(
    (await getCollection('wiki-zh')).map((entry) => [entry.id, toPage(entry, locale)]),
  );
  const pages = english.map((en) => {
    const page = translated.get(en.slug);
    translated.delete(en.slug);
    return page ? { ...page, sortTitle: en.title } : en;
  });
  return [...pages, ...translated.values()].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
}

/**
 * Every wiki page with its computed categories and callouts, A to Z by (English) title.
 * For zh, each page is the Chinese version where one exists, else the English one.
 */
export function getPages(locale: Locale = DEFAULT_LOCALE): Promise<Page[]> {
  if (!import.meta.env.PROD) return load(locale);
  let pages = cache.get(locale);
  if (!pages) {
    pages = load(locale);
    cache.set(locale, pages);
  }
  return pages;
}

/** Every category name: the areas, plus any used by a page. */
export async function getCategories(locale: Locale = DEFAULT_LOCALE): Promise<Map<string, Page[]>> {
  const all = await getPages(locale);
  const names = new Set<string>(AREAS);
  for (const page of all) for (const c of page.categories) names.add(c);
  const map = new Map<string, Page[]>();
  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    map.set(
      name,
      all.filter((p) => p.categories.includes(name)),
    );
  }
  return map;
}

export function categoryBySlug(categories: Map<string, Page[]>, slug: string): string | undefined {
  return [...categories.keys()].find((name) => slugify(name) === slug);
}

/** The file's last commit date (YYYY-MM-DD), or undefined without git history. */
export function lastEdited(file: string, locale: Locale = DEFAULT_LOCALE): string | undefined {
  const path = join(WIKI_DIRS[locale], file);
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

export function formatDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
