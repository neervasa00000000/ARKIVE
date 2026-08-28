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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    headers: SECURITY_HEADERS,
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
    viteTurboSponsor(),
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
