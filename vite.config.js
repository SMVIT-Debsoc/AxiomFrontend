import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  }
})
