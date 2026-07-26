import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The web app is served under the Funnel mount path `/learn/`. Vite bakes
  // this into the HTML's asset URLs at build time — without it, the script
  // and stylesheet tags resolve to `/assets/...` (which hits the Funnel root,
  // not the app), and the browser refuses to load JavaScript or CSS served
  // with `Content-Type: text/html`. Set this if the Funnel mount ever moves.
  base: '/learn/',
  // Tailscale Funnel preserves the public Host header when it forwards the
  // request, so `vite preview` needs to allow the public hostname explicitly —
  // otherwise it 403s every load with "this host is not allowed". localhost /
  // 127.0.0.1 are allowed by default; only the Funnel hostname needs listing.
  preview: {
    allowedHosts: ['aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net'],
  },
})