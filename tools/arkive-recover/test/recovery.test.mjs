import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { inspectArchive, parseArchive, recoverWithPassphrase } from '../core.mjs'

const ROOT = resolve(import.meta.dirname, '../../..')
const ARCHIVE = resolve(ROOT, 'research/fixtures/archives/passphrase-v1.arkive')
const EXPECTED = resolve(ROOT, 'research/fixtures/expected/hashes.json')
const METADATA = resolve(ROOT, 'research/fixtures/metadata.json')

async function fixture() {
  const [archive, expected, metadata] = await Promise.all([
    readFile(ARCHIVE),
    readFile(EXPECTED, 'utf8').then(JSON.parse),
    readFile(METADATA, 'utf8').then(JSON.parse),
  ])
  return { archive, expected, passphrase: metadata.testOnlyPassphrase }
}

test('inspect validates the committed archive without revealing secrets', async () => {
  const { archive, expected, passphrase } = await fixture()
  const result = inspectArchive(archive)
  assert.equal(result.bundleVersion, 3)
  assert.equal(result.recoverySpecVersion, '1')
  assert.equal(result.archiveIntegrity, 'PASS')
  assert.equal(result.archiveSha256, expected.archiveSha256)
  assert.ok(!JSON.stringify(result).includes(passphrase))
})

test('recovers the exact committed binary fixture', async () => {
  const { archive, expected, passphrase } = await fixture()
  const result = await recoverWithPassphrase(archive, passphrase)
  const original = await readFile(resolve(ROOT, 'research/fixtures/plaintext/recovery-test.bin'))
  assert.deepEqual(result.plaintext, original)
  assert.equal(result.recoveredSha256, expected.plaintextSha256)
  assert.equal(result.exactByteMatch, true)
})

test('wrong credential fails closed', async () => {
  const { archive } = await fixture()
  await assert.rejects(recoverWithPassphrase(archive, 'wrong test credential'), {
    code: 'WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP',
  })
})

test('ciphertext corruption fails closed', async () => {
  const { archive, passphrase } = await fixture()
  const corrupted = Buffer.from(archive)
  corrupted[corrupted.length - 1] ^= 1
  await assert.rejects(recoverWithPassphrase(corrupted, passphrase), {
    code: 'CONTENT_HASH_MISMATCH',
  })
})

test('authenticated metadata corruption fails closed', async () => {
  const { archive, passphrase } = await fixture()
  const parsed = parseArchive(archive)
  const header = structuredClone(parsed.header)
  const encryptedMetadata = Buffer.from(header.encryptedMetadata, 'base64')
  encryptedMetadata[0] ^= 1
  header.encryptedMetadata = encryptedMetadata.toString('base64')
  const headerBytes = Buffer.from(JSON.stringify(header))
  const modified = Buffer.alloc(9 + headerBytes.length + parsed.ciphertext.length)
  modified.write('ARKV', 0)
  modified[4] = 3
  modified.writeUInt32BE(headerBytes.length, 5)
  headerBytes.copy(modified, 9)
  parsed.ciphertext.copy(modified, 9 + headerBytes.length)
  await assert.rejects(recoverWithPassphrase(modified, passphrase), {
    code: 'METADATA_AUTHENTICATION_FAILED',
  })
})

test('unsupported archive version is rejected explicitly', async () => {
  const { archive } = await fixture()
  const unsupported = Buffer.from(archive)
  unsupported[4] = 4
  assert.throws(() => parseArchive(unsupported), { code: 'UNSUPPORTED_BUNDLE_VERSION' })
})
