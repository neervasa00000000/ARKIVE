/**
 * Production build gate — fails build if demo mode is on in production.
 * Set VITE_STRICT_PRODUCTION=false to skip (local preview only).
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env')

if (process.env.VITE_STRICT_PRODUCTION === 'false') {
  console.log('[check-production-env] Skipped (VITE_STRICT_PRODUCTION=false)')
  process.exit(0)
}

let envContent = ''
if (existsSync(envPath)) {
  envContent = readFileSync(envPath, 'utf8')
}

const demoMode = /VITE_DEMO_MODE\s*=\s*true/i.test(envContent)
const demoUnset = !/VITE_DEMO_MODE\s*=/i.test(envContent)

if (demoMode || demoUnset) {
  console.error(
    '\n[ARKIVE SECURITY] Production build blocked.\n' +
      'Set VITE_DEMO_MODE=false in frontend/.env before npm run build.\n' +
      'For local dev builds only: VITE_STRICT_PRODUCTION=false npm run build\n',
  )
  process.exit(1)
}

console.log('[check-production-env] OK — demo mode disabled for production build')
