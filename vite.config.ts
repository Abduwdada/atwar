import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// يُثبَّت التطبيق على الشاشة الرئيسية ويعمل بلا إنترنت
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png'],
      manifest: {
        name: 'أطوار',
        short_name: 'أطوار',
        description: 'رصد تطور العلوم عبر نصوص كتبها وكشف النقل بين المصنفين',
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        start_url: './',
        theme_color: '#1d6b59',
        background_color: '#f4f6f3',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
})
