import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    image: z.string().optional(),
    headerImage: z.boolean().optional(),
    comments: z.boolean().optional(),
    lang: z.string().default('en'),
    tag: z.array(z.string()).default([]),
    category: z.string().optional(),
    author: z.string().optional(),
  }),
});

export const collections = { blog };
