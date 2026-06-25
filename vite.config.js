import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

function serveWasmFromDeps() {
  const VARIANTS = [
    'quickjs-wasmfile-release-sync',
    'quickjs-wasmfile-release-asyncify',
    'quickjs-wasmfile-debug-sync',
    'quickjs-wasmfile-debug-asyncify',
  ];

  let wasmLookup = null;
  function buildLookup() {
    if (wasmLookup) return wasmLookup;
    wasmLookup = new Map();
    const projRequire = createRequire(join(process.cwd(), 'package.json'));
    const qjsPkg = projRequire.resolve('quickjs-emscripten/package.json');
    const qjsRequire = createRequire(qjsPkg);
    for (const variant of VARIANTS) {
      try {
        const pkg = qjsRequire.resolve(`@jitl/${variant}/package.json`);
        wasmLookup.set(variant, join(dirname(pkg), 'dist'));
      } catch { /* variant not installed */ }
    }
    return wasmLookup;
  }

  return {
    name: 'serve-wasm-deps',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.endsWith('.wasm')) return next();
        const wasmName = req.url.split('/').pop();
        for (const [, dir] of buildLookup()) {
          try {
            const data = await readFile(join(dir, wasmName));
            res.setHeader('Content-Type', 'application/wasm');
            res.end(data);
            return;
          } catch { /* try next */ }
        }
        return next();
      });
    },
  };
}

const EXERCISE_JSON_RE = /src\/exercises\/(?!registry|_template)[^/]+\.json$/;

function stripReferenceSolution() {
  return {
    name: 'strip-reference-solution',
    enforce: 'pre',
    transform(src, id) {
      if (!EXERCISE_JSON_RE.test(id)) return null;
      const data = JSON.parse(src);
      delete data.referenceSolution;
      // Return stripped JSON — vite:json transform (runs after) wraps it in ESM.
      return { code: JSON.stringify(data), map: null };
    },
  };
}

export default defineConfig({
  base: '/trainer/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  plugins: [
    serveWasmFromDeps(),
    stripReferenceSolution(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'The Refactory',
        short_name: 'Refactory',
        description: 'Practice coding with sandboxed exercises',
        theme_color: '#0a0a1a',
        background_color: '#0a0a1a',
        display: 'standalone',
        start_url: '/trainer/',
        scope: '/trainer/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,json}'],
        globIgnores: ['exercises/*.json'],
        navigateFallback: '/trainer/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ]
});
