import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../results/latest')
const allowedResults = new Set(['PASS', 'FAIL', 'NOT VALIDATED', 'SKIPPED'])
const allowedOutcomes = new Set([
  'RECOVERY_SUCCESS',
  'RECOVERY_REJECTED',
  'NOT_IMPLEMENTED',
  'ENVIRONMENT_UNAVAILABLE',
])
const forbiddenKeys = /passphrase|privatekey|private_key|seedphrase|seed_phrase|mnemonic|aeskey|aes_key|rawfilekey|raw_file_key/i

for (let number = 1; number <= 13; number++) {
  const id = `E${String(number).padStart(2, '0')}`
  const raw = await readFile(resolve(root, `${id}.json`), 'utf8')
  const result = JSON.parse(raw)
  assert.equal(result.experiment, id)
  assert.ok(allowedResults.has(result.result), `${id}: invalid result`)
  assert.ok(allowedOutcomes.has(result.actualOutcome), `${id}: invalid actual outcome`)
  assert.match(result.gitCommit, /^[a-f0-9]{40}$/)
  assert.ok(Array.isArray(result.removedDependencies))
  assert.ok(Array.isArray(result.availableDependencies))
  assert.ok(Array.isArray(result.externalEndpointsContacted))
  assert.ok(Number.isInteger(result.durationMs) && result.durationMs >= 0)
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbiddenKeys.test(key), `${id}: forbidden result field ${key}`)
      visit(child)
    }
  }
  visit(result)
}

const cleanRoom = JSON.parse(await readFile(resolve(root, 'CLEAN-ROOM.json'), 'utf8'))
assert.equal(cleanRoom.result, 'PASS')
assert.equal(cleanRoom.exactByteMatch, true)
assert.deepEqual(cleanRoom.externalEndpointsContacted, [])
console.log('Research result validation: PASS')
