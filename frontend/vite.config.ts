import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'robots.txt', 'logo.png'],
      manifest: {
        name: 'Aether - Sovereign Mesh Protocol',
        short_name: 'Aether',
        description: 'Zero-trust end-to-end encrypted decentralized mesh communication. No logs, no masters, no trace.',
        theme_color: '#030005',
        background_color: '#030005',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['communication', 'productivity'],
        screenshots: [
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ],
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      }
    })
  ],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: false
  }
});