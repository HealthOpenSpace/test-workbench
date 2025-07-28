import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use environment variable for base path, fallback to /test-workbench/ for GitHub Pages
  base: process.env.VITE_BASE_PATH || '/test-workbench/',
  optimizeDeps: {
    include: ['monaco-editor']
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
  },
  css: {
    postcss: './postcss.config.js'
  },
  server: {
    port: 3000,
    open: true
  },
  define: {
    global: 'globalThis',
  },
  worker: {
    format: 'es'
  }
})