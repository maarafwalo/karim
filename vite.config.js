import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'joud — نقطة البيع',
        short_name: 'joud',
        description: 'نظام نقطة البيع والكتالوج والمخزون',
        theme_color: '#1a56db',
        background_color: '#f0f2f5',
        display: 'standalone',
        dir: 'rtl',
        lang: 'ar',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // Only cache Supabase REST GETs. Auth, realtime, storage, and any
            // mutation (POST/PATCH/DELETE) must always hit the network — caching
            // them returns stale auth tokens or replays a stale insert payload.
            urlPattern: ({ url, request }) =>
              /^https:\/\/.*\.supabase\.co\/rest\/v1\//i.test(url.href)
              && request.method === 'GET',
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https:\/\/suk\.ma\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'product-images', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
})
