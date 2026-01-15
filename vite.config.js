import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,
    port: 3000,
    allowedHosts: ['fshdwdz2fi.us-east-1.awsapprunner.com']
  },
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
