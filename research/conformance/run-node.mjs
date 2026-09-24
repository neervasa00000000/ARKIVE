import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, webcrypto } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const vectors = JSON.parse(readFileSync(resolve(ROOT, 'research/conformance/vectors.json'), 'utf8'))
const archive = readFileSync(resolve(ROOT, vectors.framing.fixture))
const hex = (bytes) => Buffer.from(bytes).toString('hex')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

assert.equal(hex(archive.subarray(0, 4)), vectors.framing.magicHex)
assert.equal(archive[4], vectors.framing.version)
assert.equal(archive.readUInt32BE(5), vectors.framing.headerLength)
const headerBytes = archive.subarray(9, vectors.framing.ciphertextOffset)
const ciphertext = archive.subarray(vectors.framing.ciphertextOffset)
const header = JSON.parse(new TextDecoder().decode(headerBytes))
assert.equal(archive.length, vectors.framing.archiveBytes)
assert.equal(sha256(headerBytes), vectors.framing.headerSha256)
assert.equal(sha256(ciphertext), vectors.framing.ciphertextSha256)

for (const item of vectors.passphraseEncodingVectors.cases) {
  const encoded = new TextEncoder().encode(item.text)
  assert.equal(hex(encoded), item.utf8Hex, item.id)
  assert.equal(item.text.length, item.utf16CodeUnits, item.id)
  const material = await webcrypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveBits'])
  const key = await webcrypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', iterations: vectors.passphraseEncodingVectors.iterations,
    salt: Buffer.from(vectors.passphraseEncodingVectors.saltHex, 'hex'),
  }, material, 256)
  assert.equal(hex(key), item.derivedKeyHex, item.id)
}
assert.notEqual(vectors.passphraseEncodingVectors.cases[3].derivedKeyHex, vectors.passphraseEncodingVectors.cases[4].derivedKeyHex)

const fixture = vectors.fixtureRecovery
const password = new TextEncoder().encode(fixture.testOnlyPassphrase)
assert.equal(hex(password), fixture.passphraseUtf8Hex)
const material = await webcrypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
const wrappingBits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: fixture.iterations, salt: Buffer.from(fixture.saltHex, 'hex') }, material, 256)
assert.equal(hex(wrappingBits), fixture.derivedWrappingKeyHex)
const wrappingKey = await webcrypto.subtle.importKey('raw', wrappingBits, 'AES-GCM', false, ['decrypt'])
const fileKeyBytes = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(fixture.wrapIvHex, 'hex') }, wrappingKey, Buffer.from(fixture.wrappedFileKeyAndTagHex, 'hex'))
assert.equal(hex(fileKeyBytes), fixture.fileKeyHex)
const fileKey = await webcrypto.subtle.importKey('raw', fileKeyBytes, 'AES-GCM', false, ['decrypt'])
const metadata = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(fixture.metadataIvHex, 'hex') }, fileKey, Buffer.from(header.encryptedMetadata, 'base64'))
assert.equal(new TextDecoder().decode(metadata), fixture.metadataPlaintextUtf8)
assert.equal(sha256(Buffer.from(metadata)), fixture.metadataSha256)
const plaintext = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(fixture.fileIvHex, 'hex') }, fileKey, ciphertext)
assert.equal(Buffer.from(plaintext).length, fixture.plaintextBytes)
assert.equal(sha256(Buffer.from(plaintext)), fixture.plaintextSha256)

const work = mkdtempSync(resolve(tmpdir(), 'arkive-conformance-node-'))
const runCli = (input, credential, label) => {
  const out = resolve(work, label); mkdirSync(out)
  return spawnSync(process.execPath, [resolve(ROOT, 'tools/arkive-recover/cli.mjs'), 'recover', input, '--output', out, '--json'], {
    cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, ARKIVE_RECOVERY_PASSPHRASE: credential },
  })
}
try {
  const fixturePath = resolve(ROOT, vectors.framing.fixture)
  const positive = runCli(fixturePath, fixture.testOnlyPassphrase, 'positive')
  assert.equal(positive.status, 0, positive.stderr)
  const recovered = readFileSync(resolve(work, 'positive', readdirSync(resolve(work, 'positive'))[0]))
  assert.equal(sha256(recovered), fixture.plaintextSha256)
  const corrupt = Buffer.from(archive); corrupt[corrupt.length - 1] ^= 1
  const corruptPath = resolve(work, 'corrupt.arkive'); writeFileSync(corruptPath, corrupt)
  const unsupported = Buffer.from(archive); unsupported[4] = 4
  const unsupportedPath = resolve(work, 'unsupported.arkive'); writeFileSync(unsupportedPath, unsupported)
  const errorClass = (child) => child.stderr.match(/ARKIVE_RECOVERY_ERROR ([A-Z0-9_]+)/)?.[1] || null
  const negative = {
    wrongCredential: errorClass(runCli(fixturePath, 'wrong synthetic credential', 'wrong')),
    ciphertextCorruption: errorClass(runCli(corruptPath, fixture.testOnlyPassphrase, 'corrupt')),
    unsupportedVersion: errorClass(runCli(unsupportedPath, fixture.testOnlyPassphrase, 'unsupported')),
  }
  assert.deepEqual(negative, {
    wrongCredential: 'WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP',
    ciphertextCorruption: 'CONTENT_HASH_MISMATCH',
    unsupportedVersion: 'UNSUPPORTED_BUNDLE_VERSION',
  })
  console.log(JSON.stringify({ implementation: 'Node WebCrypto + arkive-recover black box', deterministicVectors: 'PASS', archiveRecovery: 'PASS', negativeVectors: negative, plaintextSha256: sha256(recovered), result: 'PASS' }))
} finally {
  rmSync(work, { recursive: true, force: true })
}
