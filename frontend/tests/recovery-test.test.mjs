import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bytesToBase64 } from '../src/lib/security.js'
import { encodeOfflineRecoveryPackage } from '../src/lib/recoverySpec.js'
import { parseVaultBytes, VAULT_SCHEMA_V3 } from '../src/lib/vaultBundle.js'
import {
  aesEncrypt,
  encryptVaultMetadata,
  exportRawKey,
  generateAesKey,
  sha256Hex,
  wrapFileKeyForPassphrase,
} from '../src/lib/vaultKeyWrap.js'
import {
  availableRecoveryMethods,
  readRecoveryTestRecords,
  saveRecoveryTestRecord,
  testPassphraseRecovery,
} from '../src/lib/recoveryTest.js'

const PASSPHRASE = 'correct independent recovery phrase'
const ARCHIVE_ID = 'r'.repeat(43)

async function fixture({ originalHash } = {}) {
  const original = new TextEncoder().encode('exact recovery bytes\n')
  const key = await generateAesKey()
  const raw = await exportRawKey(key)
  const encrypted = await aesEncrypt(key, original)
  const metadata = await encryptVaultMetadata(key, {
    originalFileName: 'evidence.txt',
    originalFileType: 'text/plain',
    originalContentHash: originalHash || await sha256Hex(original),
  })
  raw.fill(0)
  const header = {
    schema: VAULT_SCHEMA_V3,
    contentHash: await sha256Hex(encrypted.encrypted),
    encryptedFileIv: bytesToBase64(encrypted.iv),
    ...metadata,
    recoveryWrap: await wrapFileKeyForPassphrase(await exportRawKey(key), PASSPHRASE),
  }
  const bundle = encodeOfflineRecoveryPackage(header, encrypted.encrypted, ARCHIVE_ID)
  return { bundle, payload: parseVaultBytes(bundle) }
}

test('correct passphrase creates exact-byte PASS evidence without secrets', async () => {
  const { payload } = await fixture()
  const record = await testPassphraseRecovery(payload, PASSPHRASE, { archiveId: ARCHIVE_ID, testedAt: '2026-09-22T00:00:00.000Z' })
  assert.equal(record.integrityVerified, true)
  assert.equal(record.plaintextHashMatched, true)
  assert.equal(record.method, 'passphrase')
  assert.equal(record.testedAt, '2026-09-22T00:00:00.000Z')
  assert.ok(!JSON.stringify(record).includes(PASSPHRASE))
  assert.deepEqual(availableRecoveryMethods(payload), ['passphrase'])
})

test('wrong passphrase fails and creates no evidence', async () => {
  const { payload } = await fixture()
  await assert.rejects(testPassphraseRecovery(payload, 'wrong credential'))
})

test('corrupted ciphertext fails integrity verification', async () => {
  const { payload } = await fixture()
  payload.encryptedFileBytes[0] ^= 1
  await assert.rejects(testPassphraseRecovery(payload, PASSPHRASE), /CONTENT_HASH_MISMATCH/)
})

test('modified encrypted metadata fails authentication', async () => {
  const { payload } = await fixture()
  const bytes = Buffer.from(payload.encryptedMetadata, 'base64')
  bytes[0] ^= 1
  payload.encryptedMetadata = bytes.toString('base64')
  await assert.rejects(testPassphraseRecovery(payload, PASSPHRASE))
})

test('original plaintext hash mismatch fails', async () => {
  const { payload } = await fixture({ originalHash: '0'.repeat(64) })
  await assert.rejects(testPassphraseRecovery(payload, PASSPHRASE), /ORIGINAL_HASH_MISMATCH/)
})

test('unsupported bundle and recovery specification versions fail closed', async () => {
  const { payload } = await fixture()
  await assert.rejects(testPassphraseRecovery({ ...payload, bundleVersion: 4 }, PASSPHRASE), /UNSUPPORTED_BUNDLE_VERSION/)
  await assert.rejects(testPassphraseRecovery({ ...payload, recoverySpecVersion: '2' }, PASSPHRASE), /UNSUPPORTED_RECOVERY_SPEC/)
})

test('recovery self-test does not mutate archive bytes', async () => {
  const { bundle, payload } = await fixture()
  const before = bundle.slice()
  await testPassphraseRecovery(payload, PASSPHRASE)
  assert.deepEqual(bundle, before)
})

test('evidence storage persists only the explicit non-secret record', async () => {
  const { payload } = await fixture()
  const record = await testPassphraseRecovery(payload, PASSPHRASE)
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  saveRecoveryTestRecord({ ...record, passphrase: PASSPHRASE, plaintext: 'forbidden', rawFileKey: 'forbidden' }, storage)
  const raw = [...values.values()][0]
  assert.ok(!raw.includes(PASSPHRASE))
  assert.ok(!raw.includes('forbidden'))
  assert.deepEqual(readRecoveryTestRecords(storage), [record])
})
