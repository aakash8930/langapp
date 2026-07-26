import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tailscale Funnel preserves the public Host header when it forwards the
  // request, so `vite preview` needs to allow the public hostname explicitly —
  // otherwise it 403s every load with "this host is not allowed". localhost /
  // 127.0.0.1 are allowed by default; only the Funnel hostname needs listing.
  preview: {
    allowedHosts: ['aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net'],
  },
})
