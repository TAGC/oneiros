import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import type { Locale } from '../i18n/ui';
import remarkWiki from './remark-wiki';

const processors = new Map<string, ReturnType<typeof createProcessor>>();

function createProcessor(page?: string, locale?: Locale) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkSmartypants)
    .use(remarkWiki, { page, locale })
    .use(remarkRehype)
    .use(rehypeStringify)
    .freeze();
}

/** Renders Markdown with wiki links to HTML, outside an article body. */
export function renderMarkdown(markdown: string, page?: string, locale?: Locale): string {
  const key = `${page ?? ''}\0${locale ?? ''}`;
  let processor = processors.get(key);
  if (!processor) {
    processor = createProcessor(page, locale);
    processors.set(key, processor);
  }
  return String(processor.processSync(markdown));
}

/** Renders one line of Markdown with wiki links, without the wrapping paragraph. */
export function renderInline(markdown: string, page?: string, locale?: Locale): string {
  return renderMarkdown(markdown, page, locale)
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, '$1');
}
