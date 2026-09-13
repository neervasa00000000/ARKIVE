import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const script = fileURLToPath(new URL('../scripts/check-production-env.mjs', import.meta.url))
function check(extra) {
  return spawnSync(process.execPath, [script], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, ...extra }, encoding: 'utf8' })
}
test('deployment env overrides .env and cannot enable demo mode', () => {
  const result = check({ VITE_DEMO_MODE: 'true' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Build blocked/)
})
test('server secrets with public prefixes fail without printing values', () => {
  const result = check({ VITE_DEMO_MODE: 'false', VITE_PRIVATE_KEY: 'synthetic-secret-value' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /VITE_PRIVATE_KEY/)
  assert.ok(!result.stderr.includes('synthetic-secret-value'))
})
test('disabled demo mode passes without requiring a local .env edit', () => {
  assert.equal(check({ VITE_DEMO_MODE: 'false' }).status, 0)
})
