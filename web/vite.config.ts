import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, /api goes to the backend (backend/ runs on port 3000), so no CORS setup is needed.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
