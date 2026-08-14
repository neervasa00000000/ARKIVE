/**
 * Compact vault bundle for Arweave — raw encrypted bytes + JSON header (no base64 file bloat).
 * Magic ARKV | v3 | u32 header len | header JSON | encrypted file bytes
 */
import { bytesToBase64, base64ToBytes } from './security.js'

export const VAULT_BUNDLE_MAGIC = new Uint8Array([0x41, 0x52, 0x4b, 0x56]) // ARKV
export const VAULT_BUNDLE_VERSION = 3
export const VAULT_SCHEMA_V3 = 'ARKIVE_VAULT_BUNDLE_V3'

export function encodeVaultBundle(header, encryptedFileBytes) {
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  const out = new Uint8Array(4 + 1 + 4 + headerBytes.length + encryptedFileBytes.length)
  let o = 0
  out.set(VAULT_BUNDLE_MAGIC, o)
  o += 4
  out[o++] = VAULT_BUNDLE_VERSION
  out[o++] = (headerBytes.length >>> 24) & 0xff
  out[o++] = (headerBytes.length >>> 16) & 0xff
  out[o++] = (headerBytes.length >>> 8) & 0xff
  out[o++] = headerBytes.length & 0xff
  out.set(headerBytes, o)
  o += headerBytes.length
  out.set(encryptedFileBytes, o)
  return out
}

export function isVaultBundleBytes(data) {
  if (!(data instanceof Uint8Array) || data.length < 9) return false
  return (
    data[0] === VAULT_BUNDLE_MAGIC[0] &&
    data[1] === VAULT_BUNDLE_MAGIC[1] &&
    data[2] === VAULT_BUNDLE_MAGIC[2] &&
    data[3] === VAULT_BUNDLE_MAGIC[3] &&
    data[4] === VAULT_BUNDLE_VERSION
  )
}

export function decodeVaultBundle(bytes) {
  if (!isVaultBundleBytes(bytes)) {
    throw new Error('INVALID_VAULT_PAYLOAD')
  }
  const headerLen =
    (bytes[5] << 24) | (bytes[6] << 16) | (bytes[7] << 8) | bytes[8]
  const headerStart = 9
  const headerEnd = headerStart + headerLen
  if (headerEnd > bytes.length) throw new Error('INVALID_VAULT_PAYLOAD')

  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(headerStart, headerEnd)))
  const encryptedFileBytes = bytes.subarray(headerEnd)

  const payload = {
    ...header,
    schema: header.schema || VAULT_SCHEMA_V3,
    encryptedFileBytes,
  }
  // Avoid giant base64 strings for large files (browser memory)
  if (encryptedFileBytes.length <= 512 * 1024) {
    payload.encryptedFile = bytesToBase64(encryptedFileBytes)
  }
  return payload
}

export async function parseVaultArweaveResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    return response.json()
  }
  const buf = new Uint8Array(await response.arrayBuffer())
  return parseVaultBytes(buf)
}

/** Parse vault payload from raw bytes (v3 bundle or legacy JSON). */
export function parseVaultBytes(buf) {
  if (isVaultBundleBytes(buf)) {
    return decodeVaultBundle(buf)
  }
  const text = new TextDecoder().decode(buf).trim()
  if (text.startsWith('{')) {
    return JSON.parse(text)
  }
  throw new Error('INVALID_VAULT_PAYLOAD')
}
