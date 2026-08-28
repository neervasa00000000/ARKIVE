/**
 * Recovery Spec v1 helpers — offline package stamping.
 * Run: node --test tests/recovery-spec.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECOVERY_SPEC_VERSION,
  buildStorageLocations,
  withRecoverySpecFields,
  encodeOfflineRecoveryPackage,
  suggestArkiveFileName,
} from '../src/lib/recoverySpec.js'
import { parseVaultBytes, VAULT_SCHEMA_V3 } from '../src/lib/vaultBundle.js'

test('buildStorageLocations emits arweave primary URI', () => {
  const id = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
  const locs = buildStorageLocations({ arweaveId: id })
  assert.equal(locs.length, 1)
  assert.equal(locs[0].network, 'arweave')
  assert.equal(locs[0].uri, `arweave://${id}`)
  assert.equal(locs[0].role, 'primary')
})

test('withRecoverySpecFields stamps version', () => {
  const header = withRecoverySpecFields({ schema: VAULT_SCHEMA_V3 })
  assert.equal(header.recoverySpecVersion, RECOVERY_SPEC_VERSION)
  assert.deepEqual(header.storageLocations, [])
})

test('offline package roundtrips with stamped archiveId', () => {
  const arweaveId = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
  const ciphertext = new Uint8Array([1, 2, 3, 4, 5])
  const header = {
    schema: VAULT_SCHEMA_V3,
    encryptedFileIv: 'AAAA',
    encryptedByWallet: '0x1111111111111111111111111111111111111111',
    keyWraps: [],
  }
  const bytes = encodeOfflineRecoveryPackage(header, ciphertext, arweaveId)
  const parsed = parseVaultBytes(bytes)
  assert.equal(parsed.recoverySpecVersion, '1')
  assert.equal(parsed.archiveId, arweaveId)
  assert.equal(parsed.storageLocations[0].uri, `arweave://${arweaveId}`)
  assert.deepEqual(Array.from(parsed.encryptedFileBytes), [1, 2, 3, 4, 5])
})

test('suggestArkiveFileName is stable and safe', () => {
  const name = suggestArkiveFileName('My Wedding!.jpg', 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcde')
  assert.match(name, /\.arkive$/)
  assert.ok(!name.includes('!'))
})
