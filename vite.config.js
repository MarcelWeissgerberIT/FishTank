import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /<repo>/
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: 0,
  },
});
