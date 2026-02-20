import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      exclude: [
        'scripts/**',
        'src/main.jsx',
        '**/node_modules/**',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/vite.config.*',
        '**/eslint.config.*',
        '**/dist/**',
      ],
      reporter: [
        [resolve(__dirname, 'scripts/coverage-text-reporter.cjs'), { maxCols: 0 }],
        [resolve(__dirname, 'scripts/coverage-text-summary-reporter.cjs')],
        'html',
      ],
      outputDir: 'coverage',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/upload': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/movie': 'http://localhost:3000',
    },
  },
})
