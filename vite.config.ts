import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ai_activity_tracker/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  plugins: [
    react(),
    tailwindcss(),
    // Redirect /ai_activity_tracker or /ai_activity_tracker# to /ai_activity_tracker/ so the app loads
    {
      name: 'redirect-base-without-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || ''
          const base = '/ai_activity_tracker'
          if (url === base || url.startsWith(base + '#')) {
            res.writeHead(301, { Location: '/ai_activity_tracker/' })
            res.end()
            return
          }
          next()
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo.jpg', 'favicon.ico'],
      manifest: {
        name: 'AI Activity Tracker',
        short_name: 'Activity Tracker',
        description: 'Internal activity tracking & operational assistant',
        theme_color: '#3f4b9d',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}']
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/health': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
})
