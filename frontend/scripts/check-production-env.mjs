/** Use Vite's effective mode/env precedence, including deployment environment values. */
import { loadEnv } from 'vite'
const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'production'
const env = { ...loadEnv(mode || 'production', process.cwd(), ''), ...process.env }
if (env.VITE_DEMO_MODE !== 'false') {
  console.error('[ARKIVE SECURITY] Build blocked: set VITE_DEMO_MODE=false in the build environment.')
  process.exit(1)
}
// VITE_ values are public. Never allow obvious credential/key names into the browser.
const secretName = /(?:PRIVATE_KEY|SECRET|PASSWORD|MNEMONIC|DEPLOY_KEY|ARWEAVE_KEY|ACCESS_TOKEN)/i
const exposed = Object.keys(env).filter((key) => key.startsWith('VITE_') && secretName.test(key) && env[key])
if (exposed.length) {
  console.error('[ARKIVE SECURITY] Remove server secrets from public variables:', exposed.join(', '))
  process.exit(1)
}
console.log('[check-production-env] OK — effective demo and public-secret settings checked')
