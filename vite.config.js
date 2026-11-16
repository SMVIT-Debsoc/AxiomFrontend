import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {readFileSync} from 'node:fs'
import {ORGANISER_URL, PUBLIC_PAGES, pageMetadata} from './src/config/seo.js'
import {FIGURES, HERO_SCULPTURE_SIZES, sculptureSrcSet} from './src/components/brand/figures.js'

const htmlEntries = {'index.html': '/', 'about.html': '/about', 'app.html': '/app'}
const publicSummaryCss = readFileSync(new URL('./public/brand/public-summary.css', import.meta.url), 'utf8')

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), {
      name: 'public-page-html',
      transformIndexHtml(html, {filename}) {
        const path = htmlEntries[filename.split(/[/\\]/).at(-1)] ?? '/app'
        const page = PUBLIC_PAGES[path]
        const summary = page ? `<main class="public-page-summary">
    <h1>${page.heading}</h1>
    <p>${page.description}</p>
    <p><a href="${path === '/' ? '/about' : '/'}">${path === '/' ? 'About the tournament' : 'Tournament homepage'}</a> · <a href="${ORGANISER_URL}">SMVIT DebSoc</a></p>
  </main>` : ''
        const tags = pageMetadata(path)
        if (page) tags.push({tag: 'style', attrs: {}, children: publicSummaryCss, injectTo: 'head'})
        if (path === '/') {
          tags.push({
            tag: 'link',
            injectTo: 'head',
            attrs: {
              rel: 'preload', as: 'image', type: 'image/webp', fetchpriority: 'high',
              imagesrcset: sculptureSrcSet(FIGURES['shiva-music'].sources),
              imagesizes: HERO_SCULPTURE_SIZES,
            },
          })
        }
        return {html: html.replace('<!-- public-page-summary -->', summary), tags}
      },
    }],
    envPrefix: [
      'VITE_API_URL', 'VITE_AUTH_MOCK', 'VITE_CLERK_PUBLISHABLE_KEY',
      'VITE_GOOGLE_AUTH_ENABLED', 'VITE_SOCKET_TRANSPORTS', 'VITE_SOCKET_URL',
    ],
    build: {
      rollupOptions: {
        input: Object.keys(htmlEntries).map(file => fileURLToPath(new URL(file, import.meta.url))),
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-clerk': ['@clerk/clerk-react'],
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
