import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import type { Locale } from '../i18n/ui';
import remarkWiki from './remark-wiki';

/** Renders Markdown with wiki links to HTML, outside an article body. */
export function renderMarkdown(markdown: string, page?: string, locale?: Locale): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkSmartypants)
    .use(remarkWiki, { page, locale })
    .use(remarkRehype)
    .use(rehypeStringify);
  return String(processor.processSync(markdown));
}

/** Renders one line of Markdown with wiki links, without the wrapping paragraph. */
export function renderInline(markdown: string, page?: string, locale?: Locale): string {
  return renderMarkdown(markdown, page, locale)
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, '$1');
}
