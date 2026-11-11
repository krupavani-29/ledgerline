import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite configuration for LedgerLine frontend.
 *
 * Dev server proxy: all /api/* requests are forwarded to the Node.js
 * backend running on port 5000, avoiding CORS issues in development.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
        secure:       false,
      }
    }
  },
  build: {
    outDir:   'dist',
    // Produce a single JS chunk under 1 MB for fast first load
    chunkSizeWarningLimit: 1000,
  }
})
