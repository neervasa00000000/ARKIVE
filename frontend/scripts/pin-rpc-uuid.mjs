/**
 * Keep rpc-websockets on uuid@8.x (CJS). uuid@14 is ESM-only and crashes
 * Vercel/Netlify serverless with ERR_REQUIRE_ESM when Turbo SDK loads.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nestedDir = join(root, 'node_modules/rpc-websockets/node_modules')
const nestedPkg = join(nestedDir, 'uuid/package.json')

function uuidVersion(pkgPath) {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version || ''
  } catch {
    return ''
  }
}

const nestedVer = uuidVersion(nestedPkg)
if (nestedVer && !nestedVer.startsWith('8.') && !nestedVer.startsWith('9.') && !nestedVer.startsWith('10.') && !nestedVer.startsWith('11.')) {
  const require = createRequire(join(root, 'package.json'))
  let source
  try {
    source = dirname(require.resolve('uuid/package.json'))
  } catch {
    console.warn('[pin-rpc-uuid] uuid not installed — skip')
    process.exit(0)
  }
  const sourceVer = uuidVersion(join(source, 'package.json'))
  if (!sourceVer.startsWith('8.') && !sourceVer.startsWith('11.')) {
    console.warn('[pin-rpc-uuid] top-level uuid is', sourceVer, '— prefer overrides uuid@8.3.2')
  }
  mkdirSync(nestedDir, { recursive: true })
  rmSync(join(nestedDir, 'uuid'), { recursive: true, force: true })
  cpSync(source, join(nestedDir, 'uuid'), { recursive: true })
  console.info('[pin-rpc-uuid] replaced rpc-websockets uuid', nestedVer, '→', sourceVer)
} else if (!existsSync(join(root, 'node_modules/rpc-websockets'))) {
  /* turbo-sdk not installed in this install context */
} else {
  /* already CJS-safe or hoisted */
}
