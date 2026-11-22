import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export function resolveViteBasePath(command: 'build' | 'serve', rawBase = process.env.VITE_BASE_PATH): string {
  const explicit = String(rawBase || '').trim();
  if (explicit) {
    const withLeading = explicit.startsWith('/') ? explicit : `/${explicit}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  }
  return command === 'build' ? '/Bazaar/' : '/';
}

export default defineConfig(({ command }) => {
  const base = resolveViteBasePath(command);
  const escapedBaseApiPrefix = `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}api\\/`;

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'maskable-icon-512x512.png',
          'robots.txt',
          'sitemap.xml',
        ],
        manifest: {
          id: base,
          name: 'SB Khush — Multi-Tenant Commerce & Business Cloud',
          short_name: 'SB Khush',
          description:
            'Launch your online storefront, manage inventory, POS counter billing, customer Khata, and deliveries on SB Khush.',
          theme_color: '#065F46',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}maskable-icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api\//, new RegExp(escapedBaseApiPrefix)],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/(identitytoolkit|securetoken|firestore|firebasestorage)\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
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
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
