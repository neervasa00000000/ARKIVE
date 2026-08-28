/**
 * Force rpc-websockets onto a CJS uuid. uuid@12+ is ESM-only and crashes
 * Vercel/Netlify serverless (ERR_REQUIRE_ESM) when Turbo SDK loads Solana deps.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nestedDir = join(root, 'node_modules/rpc-websockets/node_modules')
const nestedRoot = join(nestedDir, 'uuid')
const nestedPkg = join(nestedRoot, 'package.json')

function readPkg(pkgPath) {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
}

function isEsmOnlyUuid(pkg) {
  if (!pkg?.version) return false
  const major = Number.parseInt(String(pkg.version).split('.')[0], 10)
  return major >= 12 || pkg.type === 'module'
}

if (!existsSync(join(root, 'node_modules/rpc-websockets'))) {
  process.exit(0)
}

const require = createRequire(join(root, 'package.json'))
let source
try {
  source = dirname(require.resolve('uuid/package.json'))
} catch {
  console.warn('[pin-rpc-uuid] uuid not installed — skip')
  process.exit(0)
}

const sourcePkg = readPkg(join(source, 'package.json'))
if (!sourcePkg || isEsmOnlyUuid(sourcePkg)) {
  console.warn(
    '[pin-rpc-uuid] top-level uuid is ESM-only (',
    sourcePkg?.version,
    ') — set overrides uuid@8.3.2',
  )
  process.exit(0)
}

const nestedPkgJson = readPkg(nestedPkg)
if (!nestedPkgJson || isEsmOnlyUuid(nestedPkgJson)) {
  mkdirSync(nestedDir, { recursive: true })
  rmSync(nestedRoot, { recursive: true, force: true })
  cpSync(source, nestedRoot, { recursive: true })
  console.info(
    '[pin-rpc-uuid] pinned rpc-websockets uuid',
    nestedPkgJson?.version || '(missing)',
    '→',
    sourcePkg.version,
  )
}
