import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateAesKey, exportRawKey, aesEncrypt, encryptVaultMetadata, wrapFileKeyForPassphrase, sha256Hex, unwrapFileKeyWithPassphrase } from '../src/lib/vaultKeyWrap.js'
import { encodeOfflineRecoveryPackage } from '../src/lib/recoverySpec.js'
import { parseVaultBytes, decodeVaultBundle, VAULT_SCHEMA_V3 } from '../src/lib/vaultBundle.js'
import { decryptVaultWithPassphrase } from '../src/lib/vaultCrypto.js'
import { bytesToBase64, safeBlobMimeType } from '../src/lib/security.js'

async function fixture() {
  const original = new TextEncoder().encode('Original family letter — preserve these exact bytes.\n')
  const key = await generateAesKey()
  const raw = await exportRawKey(key)
  const encrypted = await aesEncrypt(key, original)
  const metadata = await encryptVaultMetadata(key, { originalFileName: 'family.txt', originalFileType: 'text/plain', originalContentHash: await sha256Hex(original) })
  const header = { schema: VAULT_SCHEMA_V3, contentHash: await sha256Hex(encrypted.encrypted), encryptedFileIv: bytesToBase64(encrypted.iv), ...metadata, recoveryWrap: await wrapFileKeyForPassphrase(raw, 'a long independent recovery phrase') }
  return { original, bundle: encodeOfflineRecoveryPackage(header, encrypted.encrypted, 'a'.repeat(43)) }
}

test('disk export/reload recovers exact original without a wallet, cache or network', async () => {
  const { bundle, original } = await fixture()
  const dir = await mkdtemp(join(tmpdir(), 'arkive-recovery-'))
  try {
    await writeFile(join(dir, 'archive.arkive'), bundle)
    const parsed = parseVaultBytes(new Uint8Array(await readFile(join(dir, 'archive.arkive'))))
    const result = await decryptVaultWithPassphrase(parsed, 'a long independent recovery phrase')
    assert.deepEqual(result.decryptedBytes, original)
    assert.equal(result.fileName, 'family.txt')
    assert.equal(result.fileType, 'application/octet-stream')
  } finally { await rm(dir, { recursive: true }) }
})
test('wrong passphrase fails closed', async () => {
  const { bundle } = await fixture()
  await assert.rejects(decryptVaultWithPassphrase(parseVaultBytes(bundle), 'wrong passphrase'))
})
test('ciphertext corruption is detected before plaintext is returned', async () => {
  const { bundle } = await fixture()
  bundle[bundle.length - 1] ^= 1
  await assert.rejects(decryptVaultWithPassphrase(parseVaultBytes(bundle), 'a long independent recovery phrase'), /CONTENT_HASH_MISMATCH/)
})
test('GCM detects tampering even when an attacker updates the adjacent hash', async () => {
  const { bundle } = await fixture()
  const parsed = parseVaultBytes(bundle)
  parsed.encryptedFileBytes[0] ^= 1
  parsed.contentHash = await sha256Hex(parsed.encryptedFileBytes)
  await assert.rejects(decryptVaultWithPassphrase(parsed, 'a long independent recovery phrase'))
})
test('malicious KDF work factors are rejected before derivation', async () => {
  const { bundle } = await fixture()
  const wrap = parseVaultBytes(bundle).recoveryWrap
  for (const iterations of [0, -1, 1.5, 4294967295, '310000', null]) {
    await assert.rejects(unwrapFileKeyWithPassphrase({ ...wrap, iterations }, 'valid passphrase'), /INVALID_RECOVERY_PARAMETERS/)
  }
})
test('unsigned header length and truncation are rejected', () => {
  const invalid = new Uint8Array([65,82,75,86,3,255,255,255,255])
  assert.throws(() => decodeVaultBundle(invalid), /INVALID_VAULT_PAYLOAD/)
  assert.throws(() => decodeVaultBundle(new Uint8Array([65,82,75,86,3,0,0,0,2,123,125])), /INVALID_VAULT_PAYLOAD/)
})
test('active and unknown media cannot become executable blob types', () => {
  for (const type of ['image/svg+xml','text/html','image/unknown','video/unknown']) assert.equal(safeBlobMimeType(type), 'application/octet-stream')
  assert.equal(safeBlobMimeType('image/png'), 'image/png')
})
