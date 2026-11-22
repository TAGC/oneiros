/*
 * Language basics: the locales, their HTML tags, routes and fonts, and the English fallback.
 */

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Each locale's language, named in English, for the scripts' and checks' messages. */
export const LANGUAGE: Record<Locale, string> = { en: 'English', zh: 'Chinese' };

/** The `<html lang>` value; Pagefind builds one search index per value. */
export const HTML_LANG: Record<Locale, string> = { en: 'en-GB', zh: 'zh-Hans' };

/** Noto Serif SC for titles and Noto Sans SC for body text, loaded on zh pages only. */
export const CJK_FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&family=Noto+Serif+SC:wght@500;600;700&display=swap';

export function toLocale(value: unknown): Locale {
  return value === 'zh' ? 'zh' : 'en';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}

/** The `[...locale]` route param: undefined for English, so its URLs keep no prefix. */
export function localeParam(locale: Locale): string | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale;
}

/** `getStaticPaths` entries for a page under `src/pages/[...locale]/`, one per locale. */
export function localePaths() {
  return LOCALES.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));
}

/** A text in the given locale, else in English, with the language it is in. */
export function inLocale(
  texts: Partial<Record<Locale, string>>,
  locale: Locale,
): { text: string; lang: Locale } | undefined {
  const own = texts[locale];
  if (own !== undefined) return { text: own, lang: locale };
  const fallback = texts[DEFAULT_LOCALE];
  return fallback === undefined ? undefined : { text: fallback, lang: DEFAULT_LOCALE };
}
