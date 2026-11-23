import { DEFAULT_LOCALE, type Locale } from '../i18n/locale';

export const SITE = 'https://tagc.github.io';
export const BASE = '/oneiros';
export const REPO = 'https://github.com/TAGC/oneiros';
const WIKI_DIR = 'src/content/wiki';

/** Where each locale's pages live; a zh page pairs with the English page of the same slug. */
export const WIKI_DIRS: Record<Locale, string> = { en: WIKI_DIR, zh: 'src/content/wiki-zh' };

/** A site path under the base, such as `url('/glossary/')`; zh paths gain a `/zh` prefix. */
export function url(path = '/', locale: Locale = DEFAULT_LOCALE): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return BASE + prefix + (path.startsWith('/') ? path : `/${path}`);
}

export function wikiUrl(slug: string, section?: string, locale: Locale = DEFAULT_LOCALE): string {
  return url(`/wiki/${slug}/`, locale) + (section ? `#${section}` : '');
}

export function categoryUrl(name: string, locale: Locale = DEFAULT_LOCALE): string {
  return url(`/category/${slugify(name)}/`, locale);
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

export function sourceUrl(file: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${REPO}/blob/main/${WIKI_DIRS[locale]}/${file}`;
}

export function historyUrl(file: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${REPO}/commits/main/${WIKI_DIRS[locale]}/${file}`;
}
