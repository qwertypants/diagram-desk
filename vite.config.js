import { defineConfig } from 'vite';

// Assets are served from the site root, so URLs are absolute (`base: '/'`).
// Absolute asset URLs resolve identically on `/` and on History API deep links
// like `/diagrams/<id>`, which a relative base would break.
// `index.html` at the repository root is the entry point.
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
});
