import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { inspectArchive } from '../../tools/arkive-recover/core.mjs'

const root = import.meta.dirname
const expected = JSON.parse(await readFile(resolve(root, 'expected/hashes.json'), 'utf8'))
const [plaintext, archive] = await Promise.all([
  readFile(resolve(root, expected.plaintext)),
  readFile(resolve(root, expected.archive)),
])
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
assert.equal(hash(plaintext), expected.plaintextSha256, 'plaintext fixture hash mismatch')
assert.equal(hash(archive), expected.archiveSha256, 'archive fixture hash mismatch')
const inspection = inspectArchive(archive)
assert.equal(inspection.ciphertextHashActual, expected.ciphertextSha256)
assert.equal(inspection.archiveIntegrity, 'PASS')
assert.equal(inspection.bundleVersion, expected.bundleVersion)
assert.equal(inspection.recoverySpecVersion, expected.recoverySpecVersion)
console.log('Fixture integrity: PASS')
