import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const rawBase = process.env.VITE_BASE_PATH || '/';
  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  return {
    base: normalizedBase,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
        manifest: {
          id: normalizedBase,
          name: 'SB Khush — Multi-Tenant Commerce & Business Cloud',
          short_name: 'SB Khush',
          description:
            'Launch your online storefront, manage inventory, POS counter billing, customer Khata, and deliveries on SB Khush.',
          theme_color: '#065F46',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: normalizedBase,
          scope: normalizedBase,
          icons: [
            {
              src: `${normalizedBase}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${normalizedBase}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: `${normalizedBase}maskable-icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: `${normalizedBase}index.html`,
          navigateFallbackDenylist: [/^\/api\//, /\/firebase-messaging-sw\.js$/],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/(identitytoolkit|securetoken|firestore)\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'sbkhush-google-fonts-v1',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp|svg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'sbkhush-images-v1',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('/@firebase/firestore/')) {
              return 'vendor-firestore';
            }
            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'vendor-firebase';
            }
            if (id.includes('/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('/qrcode/')) {
              return 'vendor-qr';
            }
            if (id.includes('/jspdf/') || id.includes('/html2canvas/')) {
              return 'vendor-pdf';
            }
            if (id.includes('/motion/') || id.includes('/framer-motion/') || id.includes('/canvas-confetti/')) {
              return 'vendor-motion';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
