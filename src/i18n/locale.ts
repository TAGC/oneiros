/*
 * Language basics: the locales, their HTML tags and the English fallback.
 */

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** The `<html lang>` value; Pagefind builds one search index per value. */
export const HTML_LANG: Record<Locale, string> = { en: 'en-GB', zh: 'zh-Hans' };

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
