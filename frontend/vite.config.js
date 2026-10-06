import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    // ../shared holds the answer rules the backend uses too.
    fs: { allow: ['.', '../shared'] },
    // Forward API calls to the Express backend so the app and API share one origin
    // (no CORS, and the session cookie is first-party).
    proxy: {
      '/api': backend,
      '/health': backend,
    },
  },
})