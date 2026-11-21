import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { type CollectionEntry, getCollection } from 'astro:content';
import { AREAS } from './areas';
import { slugify, WIKI_DIR } from './site';
import { type Callout, CALLOUTS, extractCallouts, sourceBySlug } from './wiki';

export type Entry = CollectionEntry<'wiki'>;

export interface Page {
  entry: Entry;
  slug: string;
  file: string;
  title: string;
  categories: string[];
  callouts: Callout[];
}

let pages: Promise<Page[]> | undefined;

function fileName(entry: Entry): string {
  return entry.filePath?.split('/').pop() ?? sourceBySlug(entry.id)?.file ?? `${entry.id}.md`;
}

async function load(): Promise<Page[]> {
  const entries = await getCollection('wiki');
  return entries
    .map((entry) => {
      const callouts = extractCallouts(entry.body ?? '');
      const auto = (['open', 'conflict'] as const)
        .filter((kind) => callouts.some((c) => c.kind === kind))
        .map((kind) => CALLOUTS[kind].category);
      const categories = [...new Set([entry.data.area, ...(entry.data.categories ?? []), ...auto])];
      return {
        entry,
        slug: entry.id,
        file: fileName(entry),
        title: entry.data.title,
        categories,
        callouts,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Every wiki page with its computed categories and callouts, A to Z by title. */
export function getPages(): Promise<Page[]> {
  if (!import.meta.env.PROD) return load();
  pages ??= load();
  return pages;
}

/** Every category name: the areas, plus any used by a page. */
export async function getCategories(): Promise<Map<string, Page[]>> {
  const all = await getPages();
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
export function lastEdited(file: string): string | undefined {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', join(WIKI_DIR, file)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
