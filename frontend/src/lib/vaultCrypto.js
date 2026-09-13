/** Shared browser/offline decryption. GCM must authenticate before returning any plaintext. */
import { base64ToBytes, assertSafeDecryptedContent, safeBlobMimeType, sanitizeFileName } from './security.js'
import { aesDecrypt, decryptVaultMetadata, sha256Hex, importRawKey, unwrapFileKeyWithPassphrase } from './vaultKeyWrap.js'

export async function decryptVaultContent(fileAesKey, payload) {
  const encrypted = payload.encryptedFileBytes instanceof Uint8Array
    ? payload.encryptedFileBytes : base64ToBytes(payload.encryptedFile)
  if (payload.contentHash && await sha256Hex(encrypted) !== payload.contentHash) throw new Error('CONTENT_HASH_MISMATCH')
  const decryptedBytes = new Uint8Array(await aesDecrypt(fileAesKey, encrypted, base64ToBytes(payload.encryptedFileIv)))
  const meta = await decryptVaultMetadata(fileAesKey, payload)
  if (meta?.originalContentHash && await sha256Hex(decryptedBytes) !== meta.originalContentHash) throw new Error('ORIGINAL_HASH_MISMATCH')
  const fileName = meta?.originalFileName || payload.originalFileName
  const fileType = meta?.originalFileType || payload.originalFileType
  assertSafeDecryptedContent(decryptedBytes, fileName, fileType)
  return { decryptedBytes, meta, fileAesKey, fileName: sanitizeFileName(fileName), fileType: safeBlobMimeType(fileType) }
}

export async function decryptVaultWithPassphrase(payload, passphrase) {
  const rawKey = await unwrapFileKeyWithPassphrase(payload.recoveryWrap, passphrase)
  const key = await importRawKey(rawKey)
  rawKey.fill(0)
  return decryptVaultContent(key, payload)
}
