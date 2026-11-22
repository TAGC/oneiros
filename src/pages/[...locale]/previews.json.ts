import type { APIRoute } from 'astro';
import { type Locale, localePaths } from '../../i18n/ui';
import { getPages } from '../../lib/pages';
import { plainText } from '../../lib/wiki';

export const getStaticPaths = localePaths;

/**
 * Title and summary per slug: hover previews and the random page read this.
 * In zh, a page with only an English version carries a third item, its language.
 */
export const GET: APIRoute = async ({ props }) => {
  const locale = (props as { locale: Locale }).locale;
  const pages = await getPages(locale);
  const data = Object.fromEntries(
    pages.map((p) => {
      const preview = [p.title, plainText(p.entry.data.summary)];
      return [p.slug, p.locale === locale ? preview : [...preview, p.locale]];
    }),
  );
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
