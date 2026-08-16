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
      // Route components (and their component-only imports) become dynamic
      // chunks. Public landing/auth routes no longer download the dashboard,
      // practice suites, admin panels, or their feature CSS before first paint.
      autoCodeSplitting: true,
      codeSplittingOptions: {
        // Loaders often import the shared API plus feature-specific helpers.
        // Keeping them in the route tree would preload learning code even when
        // the matched route is only /, /signin, /signup, or /verify-email.
        defaultBehavior: [
          ['loader'],
          ['component'],
          ['errorComponent'],
          ['notFoundComponent'],
        ],
      },
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'GENKŌ',
        short_name: 'GENKŌ',
        description: 'Japanese lessons, review, and progress that stay in sync',
        theme_color: '#090c0b',
        background_color: '#090c0b',
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
  // Dev previews arrive through Arena's generated e2b.app host; production
  // preview also keeps the public Funnel host. Neither surface should reject
  // the Host header before the app can render.
  server: {
    allowedHosts: ['.e2b.app'],
  },
  preview: {
    allowedHosts: ['.e2b.app', 'aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net'],
  },
})