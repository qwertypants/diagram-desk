import { defineConfig } from 'vite';

// The server treats `dist/` as an opaque static directory, so the build stays
// path-relative (`base: './'`) and nothing here leaks into the served output.
// `index.html` at the repository root is the entry point.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
});
