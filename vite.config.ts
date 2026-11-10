import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Build settings for an app that ends up in ESP32 flash.
 *
 * - `base: './'` makes every asset reference relative, so the built files work
 *   whether the ESP32 serves them from `/` or from a subdirectory.
 * - Vendor code is split out so a change to the app does not invalidate the
 *   large library chunks on a device that caches them.
 * - Filenames are kept short: some ESP32 filesystems (SPIFFS in particular)
 *   have a low path-length limit.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'a',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        entryFileNames: 'a/[name]-[hash:8].js',
        chunkFileNames: 'a/[name]-[hash:8].js',
        assetFileNames: 'a/[name]-[hash:8].[ext]',
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          // Order matters: react-leaflet must be matched before 'react'.
          if (id.includes('leaflet')) return 'map';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory'))
            return 'charts';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
