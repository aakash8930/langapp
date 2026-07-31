import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    // TanStack Router's file-based routes plugin. Generates `routeTree.gen.ts`
    // from the `src/routes/` tree at dev/build time. Must run before the React
    // plugin so the generated module is available when React resolves imports.
    TanStackRouterVite({
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'LangApp',
        short_name: 'LangApp',
        description: 'Super-App Language Learning Platform',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
  ],
  // The web app is served under the Funnel mount path `/learn/`. Vite bakes
  // the asset prefix into the HTML's <script> and <link> tags at build time.
  // We use *relative* paths here (`./`) instead of an absolute `/learn/`
  // because `vite preview` interprets the absolute base as a redirect target
  // — it then 302s every upstream request to `/learn/`, which Tailscale
  // Funnel forwards back to `/` and loops. Relative paths keep the HTML's
  // URLs as `assets/index-...js`; the browser resolves them against the
  // request URL (`/learn/...`), so Funnel still strips `/learn` and serves
  // the right files upstream.
  base: './',
  // Tailscale Funnel preserves the public Host header when it forwards the
  // request, so `vite preview` needs to allow the public hostname explicitly —
  // otherwise it 403s every load with "this host is not allowed". localhost /
  // 127.0.0.1 are allowed by default; only the Funnel hostname needs listing.
  preview: {
    allowedHosts: ['aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net'],
  },
})