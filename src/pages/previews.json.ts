import type { APIRoute } from 'astro';
import { getPages } from '../lib/pages';
import { plainText } from '../lib/wiki';

/** Title and summary per slug: hover previews and the random page read this. */
export const GET: APIRoute = async () => {
  const pages = await getPages();
  const data = Object.fromEntries(
    pages.map((p) => [p.slug, [p.title, plainText(p.entry.data.summary)]]),
  );
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
