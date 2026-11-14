import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'ADMIN_SECRET_KEY'],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-clerk': ['@clerk/clerk-react'],
            'vendor-motion': ['framer-motion'],
            'vendor-socket': ['socket.io-client'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 8080,
      allowedHosts: true,
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  }
})
