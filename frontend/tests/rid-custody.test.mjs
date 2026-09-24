/**
 * B7 Candidate 1 — RID custody / stamped recovery artifact.
 * Primary regression: upload success + registration failure still yields stamped artifact.
 * Run: node --test tests/rid-custody.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECOVERY_DISCOVERY_STATE,
  assertValidStorageRid,
  buildStorageLocations,
  withRecoverySpecFields,
  encodeOfflineRecoveryPackage,
  extractDiscoveryFromArtifact,
  classifyRecoveryDiscoveryState,
} from '../src/lib/recoverySpec.js'
import {
  finalizeAfterStorageRid,
  shouldWarnBeforeDiscardingRecoveryCustody,
} from '../src/lib/ridCustody.js'
import { parseVaultBytes, VAULT_SCHEMA_V3, encodeVaultBundle } from '../src/lib/vaultBundle.js'
import {
  generateAesKey,
  exportRawKey,
  aesEncrypt,
  encryptVaultMetadata,
  wrapFileKeyForPassphrase,
  wrapFileKeyForWallet,
  sha256Hex,
} from '../src/lib/vaultKeyWrap.js'
import { decryptVaultWithPassphrase } from '../src/lib/vaultCrypto.js'
import { bytesToBase64 } from '../src/lib/security.js'

const VALID_RID = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
assert.equal(VALID_RID.length, 43)

function baseHeader(extra = {}) {
  return {
    schema: VAULT_SCHEMA_V3,
    encryptedFileIv: 'AAAA',
    encryptedByWallet: '0x1111111111111111111111111111111111111111',
    keyWraps: [],
    ...extra,
  }
}

test('1. valid RID stamping', () => {
  const ciphertext = new Uint8Array(16).fill(3)
  const bytes = encodeOfflineRecoveryPackage(baseHeader(), ciphertext, VALID_RID)
  const parsed = parseVaultBytes(bytes)
  assert.equal(parsed.archiveId, VALID_RID)
  assert.equal(assertValidStorageRid(parsed.archiveId), VALID_RID)
})

test('2. malformed RID rejection', () => {
  const ciphertext = new Uint8Array(8).fill(1)
  const cases = [
    '',
    'short',
    'a'.repeat(42),
    'a'.repeat(44),
    '!!!@@@###$$$%%%^^^&&&***(((|||)))___+++',
    null,
    undefined,
  ]
  for (const rid of cases) {
    assert.throws(() => encodeOfflineRecoveryPackage(baseHeader(), ciphertext, rid), /INVALID_ARWEAVE_ID/)
    assert.throws(() => assertValidStorageRid(rid), /INVALID_ARWEAVE_ID/)
  }
  assert.throws(() => buildStorageLocations({ arweaveId: 'not-valid' }), /INVALID_ARWEAVE_ID/)
})

test('3. upload success + registration success', async () => {
  const ciphertext = new Uint8Array(16).fill(9)
  let called = false
  const outcome = await finalizeAfterStorageRid({
    header: baseHeader(),
    encryptedFileBytes: ciphertext,
    storageRid: VALID_RID,
    originalFileName: 'photo.jpg',
    registerOnChain: async (rid) => {
      called = true
      assert.equal(rid, VALID_RID)
    },
  })
  assert.equal(called, true)
  assert.equal(outcome.uploadSucceeded, true)
  assert.equal(outcome.registrationSucceeded, true)
  assert.equal(outcome.recoveryDiscoveryState, RECOVERY_DISCOVERY_STATE.REGISTRY_CONFIRMED)
  assert.equal(outcome.recoveryArtifactAvailable, true)
  assert.ok(outcome.offlinePackage instanceof Uint8Array)
})

test('4+5. upload success + registration failure still produces stamped artifact', async () => {
  const ciphertext = new Uint8Array(16).fill(5)
  const outcome = await finalizeAfterStorageRid({
    header: baseHeader(),
    encryptedFileBytes: ciphertext,
    storageRid: VALID_RID,
    originalFileName: 'letter.txt',
    registerOnChain: async () => {
      throw new Error('BASE_UNAVAILABLE')
    },
  })
  assert.equal(outcome.uploadSucceeded, true)
  assert.equal(outcome.registrationSucceeded, false)
  assert.match(outcome.registrationError, /BASE_UNAVAILABLE/)
  assert.equal(outcome.recoveryArtifactAvailable, true)
  assert.equal(outcome.recoveryDiscoveryState, RECOVERY_DISCOVERY_STATE.RID_STAMPED)
  assert.ok(outcome.offlinePackage.length > 0)

  const discovery = extractDiscoveryFromArtifact(outcome.offlinePackage)
  assert.equal(discovery.archiveId, VALID_RID)
})

test('6+7. stamped archive contains expected archiveId and storageLocations', () => {
  const bytes = encodeOfflineRecoveryPackage(baseHeader(), new Uint8Array(16).fill(4), VALID_RID)
  const discovery = extractDiscoveryFromArtifact(bytes)
  assert.equal(discovery.archiveId, VALID_RID)
  assert.equal(discovery.storageLocations.length, 1)
  assert.equal(discovery.storageLocations[0].network, 'arweave')
  assert.equal(discovery.storageLocations[0].uri, `arweave://${VALID_RID}`)
  assert.equal(discovery.storageLocations[0].role, 'primary')
})

test('8. original ciphertext bytes remain unchanged', () => {
  const ciphertext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
  const before = ciphertext.slice()
  const stamped = encodeOfflineRecoveryPackage(baseHeader(), ciphertext, VALID_RID)
  const parsed = parseVaultBytes(stamped)
  assert.deepEqual(ciphertext, before)
  assert.deepEqual(parsed.encryptedFileBytes, before)
})

test('9. original cryptographic recovery still succeeds after stamp', async () => {
  const original = new TextEncoder().encode('Family letter for B7-R1 custody test.\n')
  const key = await generateAesKey()
  const raw = await exportRawKey(key)
  const { encrypted, iv } = await aesEncrypt(key, original)
  const contentHash = await sha256Hex(encrypted)
  const metadata = await encryptVaultMetadata(key, {
    originalFileName: 'family.txt',
    originalFileType: 'text/plain',
    originalContentHash: await sha256Hex(original),
  })
  const passphrase = 'a long independent recovery phrase'
  const header = {
    schema: VAULT_SCHEMA_V3,
    contentHash,
    encryptedFileIv: bytesToBase64(iv),
    ...metadata,
    recoveryWrap: await wrapFileKeyForPassphrase(raw, passphrase),
  }
  const stamped = encodeOfflineRecoveryPackage(header, encrypted, VALID_RID)
  const result = await decryptVaultWithPassphrase(parseVaultBytes(stamped), passphrase)
  assert.deepEqual(result.decryptedBytes, original)
})

test('10. existing unstamped archives remain readable', () => {
  const ciphertext = new Uint8Array(16).fill(2)
  const header = withRecoverySpecFields(baseHeader())
  assert.equal(header.archiveId, null)
  assert.deepEqual(header.storageLocations, [])
  const unstamped = encodeVaultBundle(header, ciphertext)
  const discovery = extractDiscoveryFromArtifact(unstamped)
  assert.equal(discovery.archiveId, null)
  assert.equal(discovery.recoveryDiscoveryState, RECOVERY_DISCOVERY_STATE.UNSTAMPED)
  assert.deepEqual(discovery.payload.encryptedFileBytes, ciphertext)
})

test('11. passphrase recovery unaffected', async () => {
  const original = new TextEncoder().encode('passphrase-path')
  const key = await generateAesKey()
  const raw = await exportRawKey(key)
  const { encrypted, iv } = await aesEncrypt(key, original)
  const header = {
    schema: VAULT_SCHEMA_V3,
    contentHash: await sha256Hex(encrypted),
    encryptedFileIv: bytesToBase64(iv),
    ...(await encryptVaultMetadata(key, {
      originalFileName: 'p.txt',
      originalFileType: 'text/plain',
      originalContentHash: await sha256Hex(original),
    })),
    recoveryWrap: await wrapFileKeyForPassphrase(raw, 'passphrase-eleven-chars'),
  }
  const stamped = encodeOfflineRecoveryPackage(header, encrypted, VALID_RID)
  const out = await decryptVaultWithPassphrase(parseVaultBytes(stamped), 'passphrase-eleven-chars')
  assert.deepEqual(out.decryptedBytes, original)
})

test('12. wallet wrap metadata unaffected where current tests permit', async () => {
  // Simulate a derived wallet AES key (not full EIP-712) to ensure wrap round-trip survives stamp.
  const fileKey = await generateAesKey()
  const rawFile = await exportRawKey(fileKey)
  const walletDerived = await generateAesKey()
  const wallet = '0x2222222222222222222222222222222222222222'
  const wrap = await wrapFileKeyForWallet(walletDerived, rawFile, wallet)
  const { encrypted, iv } = await aesEncrypt(fileKey, new TextEncoder().encode('wallet-path'))
  const header = baseHeader({
    contentHash: await sha256Hex(encrypted),
    encryptedFileIv: bytesToBase64(iv),
    keyWraps: [wrap],
    authorizedWallets: [wallet],
    walletAddress: wallet,
    encryptedByWallet: wallet,
  })
  const stamped = encodeOfflineRecoveryPackage(header, encrypted, VALID_RID)
  const parsed = parseVaultBytes(stamped)
  assert.equal(parsed.keyWraps.length, 1)
  assert.equal(parsed.keyWraps[0].wallet.toLowerCase(), wallet.toLowerCase())
  assert.equal(parsed.archiveId, VALID_RID)
  assert.ok(parsed.keyWraps[0].encryptedAesKey)
  assert.ok(parsed.keyWraps[0].iv)
})

test('13. backup-wallet metadata unaffected', async () => {
  const fileKey = await generateAesKey()
  const rawFile = await exportRawKey(fileKey)
  const ownerKey = await generateAesKey()
  const backupKey = await generateAesKey()
  const owner = '0x3333333333333333333333333333333333333333'
  const backup = '0x4444444444444444444444444444444444444444'
  const wraps = [
    await wrapFileKeyForWallet(ownerKey, rawFile, owner),
    await wrapFileKeyForWallet(backupKey, rawFile, backup),
  ]
  const { encrypted, iv } = await aesEncrypt(fileKey, new Uint8Array([9, 8, 7]))
  const header = baseHeader({
    contentHash: await sha256Hex(encrypted),
    encryptedFileIv: bytesToBase64(iv),
    keyWraps: wraps,
    authorizedWallets: [owner, backup],
    encryptedByWallet: owner,
    walletAddress: owner,
  })
  const stamped = encodeOfflineRecoveryPackage(header, encrypted, VALID_RID)
  const parsed = parseVaultBytes(stamped)
  assert.deepEqual(
    parsed.authorizedWallets.map((a) => a.toLowerCase()),
    [owner.toLowerCase(), backup.toLowerCase()],
  )
  assert.equal(parsed.keyWraps.length, 2)
})

test('failure-injection seam: synthetic RID + registry throw → stamped artifact', async () => {
  // Deterministic synthetic RID — valid Arweave/Turbo charset+length, not a live object.
  const syntheticRid = 'B7R1SyntheticRidForCustodyTest0000000000001'
  assert.equal(syntheticRid.length, 43)
  assert.match(syntheticRid, /^[a-zA-Z0-9_-]{43}$/)

  const ciphertext = new Uint8Array(20).fill(0xab)
  const outcome = await finalizeAfterStorageRid({
    header: baseHeader({ contentHash: 'a'.repeat(64) }),
    encryptedFileBytes: ciphertext,
    storageRid: syntheticRid,
    registerOnChain: async () => {
      throw new Error('VaultRegistry unavailable')
    },
  })
  assert.equal(outcome.registrationSucceeded, false)
  assert.equal(outcome.arweaveId, syntheticRid)
  const discovered = extractDiscoveryFromArtifact(outcome.offlinePackage)
  assert.equal(discovered.archiveId, syntheticRid)
  assert.equal(discovered.recoveryDiscoveryState, RECOVERY_DISCOVERY_STATE.RID_STAMPED)
})

test('classifyRecoveryDiscoveryState distinguishes stamped vs registry confirmed', () => {
  assert.equal(classifyRecoveryDiscoveryState({}), RECOVERY_DISCOVERY_STATE.UNSTAMPED)
  assert.equal(
    classifyRecoveryDiscoveryState({ archiveId: VALID_RID }),
    RECOVERY_DISCOVERY_STATE.RID_STAMPED,
  )
  assert.equal(
    classifyRecoveryDiscoveryState({ archiveId: VALID_RID, registryConfirmed: true }),
    RECOVERY_DISCOVERY_STATE.REGISTRY_CONFIRMED,
  )
})

test('exit warning only when RID present and artifact unsaved', () => {
  assert.equal(shouldWarnBeforeDiscardingRecoveryCustody({ ridPresent: true, recoveryArtifactSaved: false }), true)
  assert.equal(shouldWarnBeforeDiscardingRecoveryCustody({ ridPresent: true, recoveryArtifactSaved: true }), false)
  assert.equal(shouldWarnBeforeDiscardingRecoveryCustody({ ridPresent: false, recoveryArtifactSaved: false }), false)
})

test('tampered RID in header does not fail contentHash (documented limitation)', async () => {
  const original = new TextEncoder().encode('tamper-pointer')
  const key = await generateAesKey()
  const raw = await exportRawKey(key)
  const { encrypted, iv } = await aesEncrypt(key, original)
  const header = {
    schema: VAULT_SCHEMA_V3,
    contentHash: await sha256Hex(encrypted),
    encryptedFileIv: bytesToBase64(iv),
    ...(await encryptVaultMetadata(key, {
      originalFileName: 't.txt',
      originalFileType: 'text/plain',
      originalContentHash: await sha256Hex(original),
    })),
    recoveryWrap: await wrapFileKeyForPassphrase(raw, 'tamper-test-passphrase'),
  }
  const stamped = encodeOfflineRecoveryPackage(header, encrypted, VALID_RID)
  const parsed = parseVaultBytes(stamped)
  const otherRid = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'
  assert.equal(otherRid.length, 43)
  parsed.archiveId = otherRid
  parsed.storageLocations = [{ network: 'arweave', uri: `arweave://${otherRid}`, role: 'primary' }]
  // Re-encode tampered header with same ciphertext
  const tampered = encodeVaultBundle(
    { ...parsed, encryptedFileBytes: undefined, encryptedFile: undefined, bundleVersion: undefined },
    encrypted,
  )
  const again = parseVaultBytes(tampered)
  assert.equal(again.archiveId, otherRid)
  // Crypto recovery still succeeds — pointer is NOT authenticated by contentHash
  const result = await decryptVaultWithPassphrase(again, 'tamper-test-passphrase')
  assert.deepEqual(result.decryptedBytes, original)
})
