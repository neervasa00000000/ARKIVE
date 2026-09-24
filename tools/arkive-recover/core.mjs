import { createHash, pbkdf2Sync, webcrypto } from 'node:crypto'
import { basename } from 'node:path'

const cryptoApi = globalThis.crypto || webcrypto

export const BUNDLE_VERSION = 3
export const RECOVERY_SPEC_VERSION = '1'
export const BUNDLE_SCHEMA = 'ARKIVE_VAULT_BUNDLE_V3'
export const MAX_HEADER_BYTES = 64 * 1024
export const MAX_ARCHIVE_BYTES = 140 * 1024 * 1024
const MAGIC = Buffer.from('ARKV', 'ascii')
const PASSPHRASE_METHOD = 'passphrase-v1'

export class RecoveryError extends Error {
  constructor(code, message = code) {
    super(message)
    this.name = 'RecoveryError'
    this.code = code
  }
}

function fail(code) {
  throw new RecoveryError(code)
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function decodeBase64(value, field) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    fail(`INVALID_${field}`)
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')) {
    fail(`INVALID_${field}`)
  }
  return decoded
}

function assertHexSha256(value, code) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) fail(code)
}

export function parseArchive(bytes) {
  const archive = Buffer.from(bytes)
  if (archive.length > MAX_ARCHIVE_BYTES) fail('ARCHIVE_TOO_LARGE')
  if (archive.length < 9 || !archive.subarray(0, 4).equals(MAGIC)) fail('INVALID_MAGIC')
  const bundleVersion = archive[4]
  if (bundleVersion !== BUNDLE_VERSION) fail('UNSUPPORTED_BUNDLE_VERSION')
  const headerLength = archive.readUInt32BE(5)
  if (!headerLength || headerLength > MAX_HEADER_BYTES) fail('INVALID_HEADER_LENGTH')
  const headerEnd = 9 + headerLength
  if (headerEnd + 16 > archive.length) fail('TRUNCATED_ARCHIVE')

  let header
  try {
    header = JSON.parse(archive.subarray(9, headerEnd).toString('utf8'))
  } catch {
    fail('INVALID_HEADER_JSON')
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) fail('INVALID_HEADER_JSON')
  if (header.schema !== BUNDLE_SCHEMA) fail('UNSUPPORTED_ARCHIVE_SCHEMA')
  if (header.recoverySpecVersion !== RECOVERY_SPEC_VERSION) fail('UNSUPPORTED_RECOVERY_SPEC')

  const ciphertext = archive.subarray(headerEnd)
  assertHexSha256(header.contentHash, 'INVALID_CONTENT_HASH')
  const actualCiphertextHash = sha256Hex(ciphertext)
  return {
    archive,
    archiveSha256: sha256Hex(archive),
    bundleVersion,
    recoverySpecVersion: header.recoverySpecVersion,
    header,
    headerLength,
    headerEnd,
    ciphertext,
    ciphertextHashExpected: header.contentHash.toLowerCase(),
    ciphertextHashActual: actualCiphertextHash,
    ciphertextHashMatched: actualCiphertextHash === header.contentHash.toLowerCase(),
  }
}

export function inspectArchive(bytes) {
  const parsed = parseArchive(bytes)
  const methods = []
  if (parsed.header.recoveryWrap?.method === PASSPHRASE_METHOD) methods.push(PASSPHRASE_METHOD)
  for (const wrap of parsed.header.keyWraps || []) {
    if (wrap?.method && !methods.includes(wrap.method)) methods.push(wrap.method)
  }
  return {
    bundleVersion: parsed.bundleVersion,
    recoverySpecVersion: parsed.recoverySpecVersion,
    schema: parsed.header.schema,
    archiveSha256: parsed.archiveSha256,
    archiveIntegrity: parsed.ciphertextHashMatched ? 'PASS' : 'FAIL',
    ciphertextHashExpected: parsed.ciphertextHashExpected,
    ciphertextHashActual: parsed.ciphertextHashActual,
    contentHashStatus: parsed.ciphertextHashMatched ? 'MATCH' : 'MISMATCH',
    availableUnlockMethods: methods,
    encryptedMetadataPresent: Boolean(
      parsed.header.encryptedMetadata && parsed.header.encryptedMetadataIv,
    ),
  }
}

async function importAesKey(raw) {
  return cryptoApi.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'decrypt',
  ])
}

async function aesGcmDecrypt(key, ciphertext, iv, errorCode) {
  if (iv.length !== 12 || ciphertext.length < 16) fail('INVALID_ENCRYPTED_DATA')
  try {
    return Buffer.from(await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext))
  } catch {
    fail(errorCode)
  }
}

function derivePassphraseKey(passphrase, wrap) {
  if (wrap?.method !== PASSPHRASE_METHOD) fail('PASSPHRASE_RECOVERY_UNAVAILABLE')
  if (typeof passphrase !== 'string' || !passphrase || passphrase.length > 1024) {
    fail('INVALID_RECOVERY_PASSPHRASE')
  }
  const salt = decodeBase64(wrap.salt, 'RECOVERY_SALT')
  const iterations = wrap.iterations
  if (
    salt.length !== 16 ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000
  ) {
    fail('INVALID_RECOVERY_PARAMETERS')
  }
  return pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256')
}

function safeOutputName(value) {
  const name = basename(typeof value === 'string' ? value : 'recovered-file')
    .replace(/[\x00-\x1f\x7f]/g, '_')
    .slice(0, 200)
  if (!name || name === '.' || name === '..') return 'recovered-file'
  return name
}

export async function recoverWithPassphrase(bytes, passphrase) {
  const parsed = parseArchive(bytes)
  if (!parsed.ciphertextHashMatched) fail('CONTENT_HASH_MISMATCH')
  const wrap = parsed.header.recoveryWrap
  const wrapKeyRaw = derivePassphraseKey(passphrase, wrap)
  let rawFileKey
  try {
    const wrapKey = await importAesKey(wrapKeyRaw)
    rawFileKey = await aesGcmDecrypt(
      wrapKey,
      decodeBase64(wrap.encryptedAesKey, 'WRAPPED_FILE_KEY'),
      decodeBase64(wrap.iv, 'WRAP_IV'),
      'WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP',
    )
  } finally {
    wrapKeyRaw.fill(0)
  }

  try {
    const fileKey = await importAesKey(rawFileKey)
    const plaintext = await aesGcmDecrypt(
      fileKey,
      parsed.ciphertext,
      decodeBase64(parsed.header.encryptedFileIv, 'FILE_IV'),
      'CONTENT_AUTHENTICATION_FAILED',
    )
    if (!parsed.header.encryptedMetadata || !parsed.header.encryptedMetadataIv) {
      fail('ENCRYPTED_METADATA_REQUIRED')
    }
    const metadataBytes = await aesGcmDecrypt(
      fileKey,
      decodeBase64(parsed.header.encryptedMetadata, 'ENCRYPTED_METADATA'),
      decodeBase64(parsed.header.encryptedMetadataIv, 'METADATA_IV'),
      'METADATA_AUTHENTICATION_FAILED',
    )
    let metadata
    try {
      metadata = JSON.parse(metadataBytes.toString('utf8'))
    } catch {
      fail('INVALID_DECRYPTED_METADATA')
    }
    assertHexSha256(metadata.originalContentHash, 'INVALID_ORIGINAL_CONTENT_HASH')
    const recoveredSha256 = sha256Hex(plaintext)
    if (recoveredSha256 !== metadata.originalContentHash.toLowerCase()) {
      fail('ORIGINAL_HASH_MISMATCH')
    }
    return {
      plaintext,
      fileName: safeOutputName(metadata.originalFileName),
      fileType: typeof metadata.originalFileType === 'string' ? metadata.originalFileType : '',
      expectedSha256: metadata.originalContentHash.toLowerCase(),
      recoveredSha256,
      exactByteMatch: true,
      bundleVersion: parsed.bundleVersion,
      recoverySpecVersion: parsed.recoverySpecVersion,
      archiveSha256: parsed.archiveSha256,
      unlockMethod: PASSPHRASE_METHOD,
    }
  } finally {
    rawFileKey?.fill(0)
  }
}
