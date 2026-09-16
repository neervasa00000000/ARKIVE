import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { viteTurboSponsor } from './plugins/viteTurboSponsor.mjs'

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: http://127.0.0.1:11434 http://localhost:11434",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "media-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: [],
    // React refresh injects a development-only preamble; production preview stays strict.
    headers: { ...SECURITY_HEADERS, 'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy'].replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("connect-src 'self' https: wss: http://127.0.0.1:11434 http://localhost:11434", "connect-src 'self' https: wss: http://127.0.0.1:11434 http://localhost:11434 ws://localhost:* ws://127.0.0.1:*") },
    proxy: {
      '/api/turbo': {
        target: process.env.SPONSOR_PROXY_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: SECURITY_HEADERS,
  },
  plugins: [
    // Public sponsorship is disabled; start the isolated local prototype explicitly when needed.
    ...(process.env.SPONSOR_ENABLED === 'true' ? [viteTurboSponsor()] : []),
    { name: 'dev-csp', apply: 'serve', transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    } },
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'crypto', 'stream', 'path', 'util'],
    }),
  ],
  define: {
    global: 'globalThis', // Required for some Web3 libraries
  },
  resolve: {
    alias: {
      process: 'process/browser',
      '@ardrive/turbo-sdk': '@ardrive/turbo-sdk/web',
    },
  },
})
