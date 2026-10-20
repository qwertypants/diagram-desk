import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH || '/',
  integrations: [mdx()],
  output: 'static',
  trailingSlash: 'always',
});
