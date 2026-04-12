import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep a single CSS output for predictable plugin packaging + caching.
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024 * 20,
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
});
