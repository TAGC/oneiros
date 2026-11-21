import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { AREAS } from './lib/areas';

const wiki = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/wiki' }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['term', 'system']),
    area: z.enum(AREAS),
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
  }),
});

export const collections = { wiki };
