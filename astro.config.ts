import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import remarkWiki from './src/lib/remark-wiki';
import { BASE, SITE } from './src/lib/site';

export default defineConfig({
  site: SITE,
  base: BASE,
  markdown: {
    processor: unified({ remarkPlugins: [[remarkWiki, { article: true }]] }),
  },
  integrations: [mdx()],
});
