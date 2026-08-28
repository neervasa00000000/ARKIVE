/** Shared security helpers for ARKIVE frontend */

// Arweave transaction IDs: 43-char base64url
const ARWEAVE_TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export const LIMITS = {
  /** Hard cap — browser must hold file + encrypted copy in RAM */
  MAX_VAULT_FILE_BYTES: 100 * 1024 * 1024,
  /** Reliable on most laptops/phones */
  RECOMMENDED_VAULT_FILE_BYTES: 50 * 1024 * 1024,
  MAX_VAULT_FILE_NAME_LEN: 200,
  MAX_POST_TEXT_LEN: 2000,
  MAX_POST_IMAGE_BYTES: 10 * 1024 * 1024,
}

/** Extensions that must never be sealed (executables / active content) */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.jar', '.vbs', '.ps1',
  '.sh', '.bash', '.html', '.htm', '.xhtml', '.svg', '.php', '.asp', '.aspx',
  '.js', '.mjs', '.cjs', '.wasm', '.dmg', '.app', '.deb', '.rpm',
])

export const BLOCKED_MIME_PREFIXES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/javascript',
  'text/html',
  'image/svg+xml',
]

/** Feed / sponsor uploads — no SVG or generic image/* */
export const ALLOWED_POST_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

export const ALLOWED_SPONSOR_CONTENT_TYPES = new Set([
  ...ALLOWED_POST_IMAGE_MIMES,
  'application/json',
])

/** Allowed extensions when MIME is empty or generic octet-stream */
const ALLOWED_VAULT_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf',
  '.txt', '.md', '.csv', '.json',
  '.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
])

function fileExtension(name) {
  const dot = (name || '').lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function headerAscii(bytes, len = 16) {
  return String.fromCharCode(...bytes.slice(0, Math.min(len, bytes.length)))
    .replace(/[^\x20-\x7E]/g, '.')
    .toLowerCase()
}

function isPngMagic(bytes) {
  return bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
}

function isJpegMagic(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function isGifMagic(bytes) {
  return bytes.length >= 4
    && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
}

function isWebpMagic(bytes) {
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
}

/** Reject executable / HTML / script magic bytes (shared vault + feed defense) */
export function assertNoActiveContent(bytes) {
  if (!bytes?.length) throw new Error('INVALID_FILE')

  const head = headerAscii(bytes, 32)

  if (bytes[0] === 0x4d && bytes[1] === 0x5a) throw new Error('FILE_TYPE_BLOCKED')
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    throw new Error('FILE_TYPE_BLOCKED')
  }
  if (head.startsWith('#!')) throw new Error('FILE_TYPE_BLOCKED')
  if (head.includes('<script') || head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error('FILE_TYPE_BLOCKED')
  }
  if (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) {
    throw new Error('FILE_TYPE_BLOCKED')
  }
}

/** PNG / JPEG / GIF / WebP magic-byte check for feed images */
export function assertValidImageMagic(bytes, mimeType = '') {
  assertNoActiveContent(bytes)

  const mime = (mimeType || '').toLowerCase()
  const isPng = isPngMagic(bytes)
  const isJpeg = isJpegMagic(bytes)
  const isGif = isGifMagic(bytes)
  const isWebp = isWebpMagic(bytes)

  if (mime === 'image/png' && !isPng) throw new Error('FILE_CONTENT_MISMATCH')
  if ((mime === 'image/jpeg' || mime === 'image/jpg') && !isJpeg) throw new Error('FILE_CONTENT_MISMATCH')
  if (mime === 'image/gif' && !isGif) throw new Error('FILE_CONTENT_MISMATCH')
  if (mime === 'image/webp' && !isWebp) throw new Error('FILE_CONTENT_MISMATCH')

  if (!isPng && !isJpeg && !isGif && !isWebp) {
    throw new Error('FILE_CONTENT_MISMATCH')
  }
}

/** Detect executable / active content from magic bytes (MIME spoofing defense) */
export function assertSafeFileHeader(bytes, fileName = '', mimeType = '') {
  if (!bytes?.length) throw new Error('INVALID_FILE')

  assertNoActiveContent(bytes)

  const ext = fileExtension(fileName)
  const mime = (mimeType || '').toLowerCase()
  const head = headerAscii(bytes, 32)

  if (ext === '.pdf' || mime === 'application/pdf') {
    if (!head.startsWith('%pdf-')) throw new Error('FILE_CONTENT_MISMATCH')
  }

  if (!mime || mime === 'application/octet-stream') {
    if (!ext || !ALLOWED_VAULT_EXTENSIONS.has(ext)) {
      throw new Error('UNKNOWN_FILE_TYPE')
    }
  }

  return bytes
}

export async function validateSealFileDeep(file) {
  validateSealFile(file)
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer())
  assertSafeFileHeader(head, file.name, file.type)
  return file
}

export function assertSafeDecryptedContent(bytes, fileName = '', mimeType = '') {
  assertSafeFileHeader(bytes, fileName, mimeType)
  return bytes
}

export function needsDownloadWarning(mimeType) {
  const t = (mimeType || '').toLowerCase()
  return !(t.startsWith('image/') || t === 'application/pdf')
}

export function isValidEthAddress(address) {
  return typeof address === 'string' && ETH_ADDRESS_RE.test(address)
}

export function normalizeEthAddress(address) {
  if (!isValidEthAddress(address)) throw new Error('INVALID_ADDRESS')
  return address.toLowerCase()
}

export function validateArweaveTxId(txId) {
  if (!txId || typeof txId !== 'string') {
    throw new Error('INVALID_ARWEAVE_ID')
  }
  const trimmed = txId.trim()
  if (!ARWEAVE_TX_ID_RE.test(trimmed)) {
    throw new Error('INVALID_ARWEAVE_ID')
  }
  return trimmed
}

/** Validate file before sealing to vault */
/** Escape for HTML attribute/text when building print documents */
export function escapeHtml(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function validateSealFile(file) {
  if (!file || !(file instanceof File || file instanceof Blob)) {
    throw new Error('INVALID_FILE')
  }
  if (file.size <= 0) {
    throw new Error('INVALID_FILE')
  }
  if (file.size > LIMITS.MAX_VAULT_FILE_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }

  if (file.size > LIMITS.RECOMMENDED_VAULT_FILE_BYTES) {
    console.warn(
      `[ARKIVE] File is ${(file.size / 1024 / 1024).toFixed(1)} MB — over 50 MB may be slow or fail on mobile.`,
    )
  }

  const name = file.name || 'record'
  if (name.length > LIMITS.MAX_VAULT_FILE_NAME_LEN) {
    throw new Error('FILE_NAME_TOO_LONG')
  }

  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error('FILE_TYPE_BLOCKED')
  }

  const mime = (file.type || '').toLowerCase()
  if (BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    throw new Error('FILE_TYPE_BLOCKED')
  }

  return file
}

export function validatePostText(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) throw new Error('EMPTY_POST')
  if (trimmed.length > LIMITS.MAX_POST_TEXT_LEN) throw new Error('POST_TOO_LONG')
  return trimmed
}

export function validatePostImage(image) {
  if (!image || !(image instanceof File || image instanceof Blob)) {
    throw new Error('INVALID_FILE')
  }
  if (image.size > LIMITS.MAX_POST_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE')

  const mime = (image.type || '').toLowerCase()
  if (BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    throw new Error('FILE_TYPE_BLOCKED')
  }
  if (!ALLOWED_POST_IMAGE_MIMES.has(mime)) {
    throw new Error('FILE_TYPE_BLOCKED')
  }
  return image
}

export async function validatePostImageDeep(image) {
  validatePostImage(image)
  const head = new Uint8Array(await image.slice(0, 16).arrayBuffer())
  assertValidImageMagic(head, image.type)
  return image
}

/** Sponsor server — content-type allowlist + magic-byte sniff + exact byte count */
export function validateSponsorPayload(bytes, contentType, byteCount) {
  const mime = (contentType || '').toLowerCase()
  if (!ALLOWED_SPONSOR_CONTENT_TYPES.has(mime)) {
    throw new Error('CONTENT_TYPE_BLOCKED')
  }
  if (byteCount == null || Number(byteCount) !== bytes.length) {
    throw new Error('BYTE_COUNT_MISMATCH')
  }

  assertNoActiveContent(bytes)

  if (mime.startsWith('image/')) {
    assertValidImageMagic(bytes, mime)
    return
  }

  if (mime === 'application/json') {
    try {
      JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      throw new Error('INVALID_JSON_PAYLOAD')
    }
  }
}

/** Chunked base64 — avoids stack overflow on large files from spread operator */
export function bytesToBase64(bytes) {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(str) {
  if (!str || typeof str !== 'string') {
    throw new Error('INVALID_BASE64')
  }
  try {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
  } catch {
    throw new Error('INVALID_BASE64')
  }
}

/** Prevent path traversal / script injection in downloaded filenames */
export function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return 'arkive-record'
  const base = name
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '')
  const trimmed = base.slice(0, LIMITS.MAX_VAULT_FILE_NAME_LEN).trim()
  return trimmed || 'arkive-record'
}

const VAULT_SCHEMA = 'ARKIVE_DUAL_ENCRYPTED_VAULT_FILE'
const VAULT_SCHEMA_V3 = 'ARKIVE_VAULT_BUNDLE_V3'
const VAULT_SCHEMAS = new Set([VAULT_SCHEMA, VAULT_SCHEMA_V3])
const ALLOWED_BLOB_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
])

export function safeBlobMimeType(originalType) {
  if (!originalType || typeof originalType !== 'string') {
    return 'application/octet-stream'
  }
  const t = originalType.toLowerCase()
  if (t.startsWith('image/') || t.startsWith('video/') || t.startsWith('audio/')) {
    return originalType
  }
  if (ALLOWED_BLOB_TYPES.has(t)) return originalType
  return 'application/octet-stream'
}

export function assertVaultPayloadOwnership(payload, connectedAddress) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('INVALID_VAULT_PAYLOAD')
  }
  if (!VAULT_SCHEMAS.has(payload.schema)) {
    throw new Error('UNSUPPORTED_VAULT_FORMAT')
  }

  let normalizedOwner
  try {
    normalizedOwner = normalizeEthAddress(
      payload.encryptedByWallet || payload.walletAddress || '',
    )
  } catch {
    throw new Error('INVALID_VAULT_PAYLOAD')
  }

  if (!connectedAddress) {
    throw new Error('WALLET_NOT_CONNECTED')
  }

  const connected = normalizeEthAddress(connectedAddress)
  if (normalizedOwner === connected) return payload

  // Multi-wallet seals: any address with a key wrap (or listed authorised wallet) may decrypt
  const authorised = new Set([normalizedOwner])
  if (Array.isArray(payload.authorizedWallets)) {
    for (const w of payload.authorizedWallets) {
      try {
        authorised.add(normalizeEthAddress(w))
      } catch {
        /* ignore */
      }
    }
  }
  if (Array.isArray(payload.keyWraps)) {
    for (const wrap of payload.keyWraps) {
      if (wrap?.wallet) {
        try {
          authorised.add(normalizeEthAddress(wrap.wallet))
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (!authorised.has(connected)) {
    throw new Error('NOT_VAULT_OWNER')
  }

  return payload
}

export function assertDemoModeNotProduction() {
  if (
    import.meta.env.PROD &&
    import.meta.env.VITE_DEMO_MODE !== 'false' &&
    import.meta.env.VITE_DEMO_MODE !== false
  ) {
    throw new Error('DEMO_MODE_IN_PRODUCTION')
  }
}

export function assertProductionSecrets() {
  if (!import.meta.env.PROD) return

  const demoOff =
    import.meta.env.VITE_DEMO_MODE === 'false' ||
    import.meta.env.VITE_DEMO_MODE === false

  if (!demoOff) {
    throw new Error('DEMO_MODE_IN_PRODUCTION')
  }
}
