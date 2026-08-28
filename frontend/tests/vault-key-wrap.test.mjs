/**
 * Vault key-wrap unit tests — random file key + wallet/passphrase wraps.
 * Run: node --test tests/vault-key-wrap.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

const {
  generateAesKey,
  exportRawKey,
  importRawKey,
  aesEncrypt,
  aesDecrypt,
  wrapFileKeyForPassphrase,
  unwrapFileKeyWithPassphrase,
  wrapFileKeyForWallet,
  unwrapFileKeyWithWallet,
  findWalletKeyWrap,
  listAuthorizedWallets,
  hasRecoveryPassphraseWrap,
  PASSPHRASE_ITERATIONS,
} = await import('../src/lib/vaultKeyWrap.js')

test('random AES key encrypt/decrypt roundtrip', async () => {
  const key = await generateAesKey()
  const data = new TextEncoder().encode('wedding photos')
  const { encrypted, iv } = await aesEncrypt(key, data)
  const plain = new Uint8Array(await aesDecrypt(key, encrypted, iv))
  assert.equal(new TextDecoder().decode(plain), 'wedding photos')
})

test('passphrase wrap unlocks file key', async () => {
  const fileKey = await generateAesKey()
  const raw = await exportRawKey(fileKey)
  const wrap = await wrapFileKeyForPassphrase(raw, 'correct-horse-battery')
  assert.equal(wrap.method, 'passphrase-v1')
  assert.equal(wrap.iterations, PASSPHRASE_ITERATIONS)

  const unwrapped = await unwrapFileKeyWithPassphrase(wrap, 'correct-horse-battery')
  assert.deepEqual(unwrapped, raw)

  await assert.rejects(
    () => unwrapFileKeyWithPassphrase(wrap, 'wrong-passphrase'),
    /OperationError|decrypt|failed/i,
  )
})

test('passphrase too short is rejected', async () => {
  const raw = new Uint8Array(32)
  await assert.rejects(
    () => wrapFileKeyForPassphrase(raw, 'short'),
    (err) => err.message === 'RECOVERY_PASSPHRASE_TOO_SHORT',
  )
})

test('findWalletKeyWrap supports legacy fields and keyWraps', async () => {
  const owner = '0x1111111111111111111111111111111111111111'
  const other = '0x2222222222222222222222222222222222222222'

  const legacy = {
    encryptedByWallet: owner,
    walletEncryptedAesKey: 'YQ==',
    walletEncryptedAesKeyIv: 'Yg==',
  }
  assert.equal(findWalletKeyWrap(legacy, owner)?.wallet.toLowerCase(), owner)
  assert.equal(findWalletKeyWrap(legacy, other), null)

  const multi = {
    keyWraps: [
      {
        wallet: other,
        method: 'eip712-v2',
        encryptedAesKey: 'Yw==',
        iv: 'ZA==',
      },
    ],
  }
  assert.equal(findWalletKeyWrap(multi, other)?.wallet.toLowerCase(), other)
  assert.equal(listAuthorizedWallets({ ...legacy, ...multi }).length, 2)
  assert.equal(hasRecoveryPassphraseWrap({ recoveryWrap: { method: 'passphrase-v1' } }), true)
})

test('wallet wrap roundtrip with synthetic derived key', async () => {
  const derived = await generateAesKey()
  const fileKey = await generateAesKey()
  const raw = await exportRawKey(fileKey)
  const wallet = '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01'
  const wrap = await wrapFileKeyForWallet(derived, raw, wallet)
  assert.equal(wrap.method, 'eip712-v2')
  const unwrapped = await unwrapFileKeyWithWallet(derived, wrap)
  assert.deepEqual(unwrapped, raw)
  const imported = await importRawKey(unwrapped)
  assert.ok(imported)
})

test('encrypted metadata roundtrip and content hash', async () => {
  const {
    encryptVaultMetadata,
    decryptVaultMetadata,
    sha256Hex,
    MAX_AUTHORISED_WALLETS,
  } = await import('../src/lib/vaultKeyWrap.js')

  assert.equal(MAX_AUTHORISED_WALLETS, 3)

  const fileKey = await generateAesKey()
  const meta = {
    originalFileName: 'wedding.jpg',
    originalFileType: 'image/jpeg',
    originalFileSize: 42,
  }
  const { encryptedMetadata, encryptedMetadataIv } = await encryptVaultMetadata(fileKey, meta)
  const decrypted = await decryptVaultMetadata(fileKey, {
    encryptedMetadata,
    encryptedMetadataIv,
    originalFileName: 'sealed-record',
  })
  assert.deepEqual(decrypted, meta)

  const legacy = await decryptVaultMetadata(fileKey, {
    originalFileName: 'old.png',
    originalFileType: 'image/png',
    originalFileSize: 9,
  })
  assert.equal(legacy.originalFileName, 'old.png')

  const cipher = new Uint8Array([1, 2, 3, 4])
  const hash = await sha256Hex(cipher)
  assert.equal(hash.length, 64)
  assert.match(hash, /^[0-9a-f]+$/)
})

test('three wallet wraps resolve independently', async () => {
  const w1 = '0x1111111111111111111111111111111111111111'
  const w2 = '0x2222222222222222222222222222222222222222'
  const w3 = '0x3333333333333333333333333333333333333333'
  const d1 = await generateAesKey()
  const d2 = await generateAesKey()
  const d3 = await generateAesKey()
  const fileKey = await generateAesKey()
  const raw = await exportRawKey(fileKey)

  const keyWraps = [
    await wrapFileKeyForWallet(d1, raw, w1),
    await wrapFileKeyForWallet(d2, raw, w2),
    await wrapFileKeyForWallet(d3, raw, w3),
  ]
  const payload = {
    encryptedByWallet: w1,
    keyWraps,
    authorizedWallets: [w1, w2, w3],
  }
  assert.equal(listAuthorizedWallets(payload).length, 3)
  for (const [addr, derived] of [
    [w1, d1],
    [w2, d2],
    [w3, d3],
  ]) {
    const wrap = findWalletKeyWrap(payload, addr)
    assert.ok(wrap)
    const unwrapped = await unwrapFileKeyWithWallet(derived, wrap)
    assert.deepEqual(unwrapped, raw)
  }
})
