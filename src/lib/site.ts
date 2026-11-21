export const SITE = 'https://tagc.github.io';
export const BASE = '/oneiros';
export const REPO = 'https://github.com/TAGC/oneiros';
export const WIKI_DIR = 'src/content/wiki';

/** A site path under the base, such as `url('/glossary/')`. */
export function url(path = '/'): string {
  return BASE + (path.startsWith('/') ? path : `/${path}`);
}

export function wikiUrl(slug: string, section?: string): string {
  return url(`/wiki/${slug}/`) + (section ? `#${section}` : '');
}

export function categoryUrl(name: string): string {
  return url(`/category/${slugify(name)}/`);
}

/** Kebab-case of a title: the slug, file name and URL segment of a page. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sourceUrl(file: string): string {
  return `${REPO}/blob/main/${WIKI_DIR}/${file}`;
}

export function historyUrl(file: string): string {
  return `${REPO}/commits/main/${WIKI_DIR}/${file}`;
}
