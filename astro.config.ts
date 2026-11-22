import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import { DEFAULT_LOCALE, LOCALES } from './src/i18n/locale';
import { renderDigest } from './src/lib/render-digest';
import remarkWiki from './src/lib/remark-wiki';
import { BASE, SITE } from './src/lib/site';

export default defineConfig({
  site: SITE,
  base: BASE,
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: [...LOCALES],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkWiki, { article: true, digest: renderDigest() }]],
    }),
  },
  integrations: [mdx()],
});
