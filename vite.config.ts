import { defineConfig } from 'vite';

const INLINE_ASSET_LIMIT_BYTES = 128 * 1024;

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep a single CSS output for predictable plugin packaging + caching.
    cssCodeSplit: false,
    // Monaco's codicon font must remain self-contained inside the sandboxed
    // stylesheet. Workers are emitted separately through Vite's worker loader.
    assetsInlineLimit: INLINE_ASSET_LIMIT_BYTES,
    chunkSizeWarningLimit: 4_000,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'iife',
        entryFileNames: 'editor.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'editor.css';
          }
          return 'editor-[name]-[hash][extname]';
        },
        inlineDynamicImports: true,
      },
    },
  },
  worker: {
    format: 'iife',
  },
});
