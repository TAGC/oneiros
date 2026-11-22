import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { AREAS } from './lib/areas';
import { ICON_NAMES } from './lib/icons';
import { STATUSES } from './lib/status';

const schema = z.object({
  title: z.string(),
  kind: z.enum(['term', 'system']),
  area: z.enum(AREAS),
  icon: z.enum(ICON_NAMES).optional(),
  status: z.enum(STATUSES).optional(),
  summary: z.string(),
  aliases: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  infobox: z
    .object({
      figure: z.string().optional(),
      caption: z.string().optional(),
      rows: z.array(z.object({ label: z.string(), value: z.string() })),
    })
    .optional(),
  navbox: z.string().optional(),
});

const wiki = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/wiki' }),
  schema,
});

/** Chinese pages: the file name is the English page's slug, so the two pair up. */
const wikiZh = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/wiki-zh' }),
  schema,
});

export const collections = { wiki, 'wiki-zh': wikiZh };
