import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aesEncrypt,
  encryptVaultMetadata,
  exportRawKey,
  generateAesKey,
  sha256Hex,
  wrapFileKeyForPassphrase,
} from '../../frontend/src/lib/vaultKeyWrap.js'
import { bytesToBase64 } from '../../frontend/src/lib/security.js'
import { VAULT_SCHEMA_V3 } from '../../frontend/src/lib/vaultBundle.js'
import { encodeOfflineRecoveryPackage } from '../../frontend/src/lib/recoverySpec.js'

export const TEST_PASSPHRASE = 'TEST ONLY - ARKIVE recovery fixture 2026'
const root = dirname(fileURLToPath(import.meta.url))
const archivePath = resolve(root, 'archives/passphrase-v1.arkive')

if (!process.argv.includes('--force')) {
  try {
    await access(archivePath)
    throw new Error('Fixture already exists. Use --force only when intentionally rotating fixtures.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const text = new TextEncoder().encode(
  'ARKIVE synthetic research fixture.\nNo personal or production data is present.\n',
)
const binary = new Uint8Array(256)
for (let i = 0; i < binary.length; i++) binary[i] = (i * 73 + 19) % 256

const key = await generateAesKey()
const rawKey = await exportRawKey(key)
const encrypted = await aesEncrypt(key, binary)
const plaintextSha256 = await sha256Hex(binary)
const metadata = await encryptVaultMetadata(key, {
  originalFileName: 'recovery-test.bin',
  originalFileType: 'application/octet-stream',
  originalFileSize: binary.length,
  originalContentHash: plaintextSha256,
})
const recoveryWrap = await wrapFileKeyForPassphrase(rawKey, TEST_PASSPHRASE)
rawKey.fill(0)
const header = {
  schema: VAULT_SCHEMA_V3,
  encryptedFileIv: bytesToBase64(encrypted.iv),
  contentHash: await sha256Hex(encrypted.encrypted),
  ...metadata,
  recoveryWrap,
  keyWraps: [],
  authorizedWallets: [],
}
const archive = encodeOfflineRecoveryPackage(header, encrypted.encrypted, null)

await Promise.all([
  mkdir(resolve(root, 'plaintext'), { recursive: true }),
  mkdir(resolve(root, 'archives'), { recursive: true }),
  mkdir(resolve(root, 'expected'), { recursive: true }),
])
await writeFile(resolve(root, 'plaintext/recovery-test.txt'), text)
await writeFile(resolve(root, 'plaintext/recovery-test.bin'), binary)
await writeFile(archivePath, archive)
await writeFile(
  resolve(root, 'expected/hashes.json'),
  `${JSON.stringify({
    fixtureVersion: 1,
    archive: 'archives/passphrase-v1.arkive',
    plaintext: 'plaintext/recovery-test.bin',
    plaintextSha256,
    ciphertextSha256: header.contentHash,
    archiveSha256: await sha256Hex(archive),
    bundleVersion: 3,
    recoverySpecVersion: '1',
    unlockMethod: 'passphrase-v1',
  }, null, 2)}\n`,
)
await writeFile(
  resolve(root, 'metadata.json'),
  `${JSON.stringify({
    fixtureVersion: 1,
    classification: 'SYNTHETIC TEST DATA',
    createdFor: 'Recovery Dependency Surface experiments',
    credentialNotice: 'TEST ONLY - NOT A REAL SECRET',
    testOnlyPassphrase: TEST_PASSPHRASE,
    generationCommand: 'node research/fixtures/generate-fixtures.mjs',
    productionRandomnessPreserved: true,
  }, null, 2)}\n`,
)

console.log(`Generated synthetic fixtures at ${root}`)
