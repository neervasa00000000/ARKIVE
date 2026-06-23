import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
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
