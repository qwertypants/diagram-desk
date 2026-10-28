import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    topic: z.string(),
    tags: z.array(z.string()),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'beginner', 'intermediate', 'advanced']),
    objectives: z.array(z.string()),
    takeaways: z.array(z.string()),
    diagram: z.string(),
    legacyIds: z.array(z.string()),
    related: z.array(z.string()).optional(),
    reviewed: z.coerce.date().optional(),
    reviewBy: z.coerce.date().optional(),
  }),
});

const companions = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/companions' }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    diagram: z.string().trim().min(1),
  }),
});

export const collections = { articles, companions };
