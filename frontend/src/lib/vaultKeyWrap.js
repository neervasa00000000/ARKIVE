/**
 * Vault file-key wrapping — wallet (EIP-712) and optional recovery passphrase (PBKDF2).
 * File content is always encrypted with a random AES-256-GCM key; wraps only protect that key.
 */
import { bytesToBase64, base64ToBytes, normalizeEthAddress } from './security.js'

export const WRAP_METHOD_EIP712 = 'eip712-v2'
export const WRAP_METHOD_PASSPHRASE = 'passphrase-v1'
export const PASSPHRASE_ITERATIONS = 310_000

export async function generateAesKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportRawKey(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

export async function importRawKey(bytes) {
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function aesEncrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { encrypted: new Uint8Array(encrypted), iv }
}

export async function aesDecrypt(key, encryptedBytes, iv) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBytes)
}

async function derivePassphraseKey(passphrase, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Wrap raw AES file key for a wallet-derived AES key */
export async function wrapFileKeyForWallet(derivedKey, rawFileAesKey, walletAddress) {
  const { encrypted, iv } = await aesEncrypt(derivedKey, rawFileAesKey)
  return {
    wallet: normalizeEthAddress(walletAddress),
    method: WRAP_METHOD_EIP712,
    encryptedAesKey: bytesToBase64(encrypted),
    iv: bytesToBase64(iv),
  }
}

/** Wrap raw AES file key with a user recovery passphrase */
export async function wrapFileKeyForPassphrase(rawFileAesKey, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 8) {
    throw new Error('RECOVERY_PASSPHRASE_TOO_SHORT')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const wrapKey = await derivePassphraseKey(passphrase, salt, PASSPHRASE_ITERATIONS)
  const { encrypted, iv } = await aesEncrypt(wrapKey, rawFileAesKey)
  return {
    method: WRAP_METHOD_PASSPHRASE,
    encryptedAesKey: bytesToBase64(encrypted),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    iterations: PASSPHRASE_ITERATIONS,
  }
}

export async function unwrapFileKeyWithWallet(derivedKey, wrap) {
  const iv = base64ToBytes(wrap.iv || wrap.walletEncryptedAesKeyIv)
  const encrypted = base64ToBytes(wrap.encryptedAesKey || wrap.walletEncryptedAesKey)
  return new Uint8Array(await aesDecrypt(derivedKey, encrypted, iv))
}

export async function unwrapFileKeyWithPassphrase(recoveryWrap, passphrase) {
  if (!recoveryWrap || recoveryWrap.method !== WRAP_METHOD_PASSPHRASE) {
    throw new Error('NO_RECOVERY_WRAP')
  }
  const salt = base64ToBytes(recoveryWrap.salt)
  const iterations = Number(recoveryWrap.iterations) || PASSPHRASE_ITERATIONS
  const wrapKey = await derivePassphraseKey(passphrase, salt, iterations)
  const iv = base64ToBytes(recoveryWrap.iv)
  const encrypted = base64ToBytes(recoveryWrap.encryptedAesKey)
  return new Uint8Array(await aesDecrypt(wrapKey, encrypted, iv))
}

/** Owner + up to 2 backup wallets */
export const MAX_AUTHORISED_WALLETS = 3

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Encrypt filename / type / size so the public Arweave header does not leak them */
export async function encryptVaultMetadata(fileAesKey, metadata) {
  const plain = new TextEncoder().encode(JSON.stringify(metadata))
  const { encrypted, iv } = await aesEncrypt(fileAesKey, plain)
  return {
    encryptedMetadata: bytesToBase64(encrypted),
    encryptedMetadataIv: bytesToBase64(iv),
  }
}

export async function decryptVaultMetadata(fileAesKey, payload) {
  if (payload?.encryptedMetadata && payload?.encryptedMetadataIv) {
    const plain = await aesDecrypt(
      fileAesKey,
      base64ToBytes(payload.encryptedMetadata),
      base64ToBytes(payload.encryptedMetadataIv),
    )
    return JSON.parse(new TextDecoder().decode(plain))
  }
  return {
    originalFileName: payload?.originalFileName,
    originalFileType: payload?.originalFileType,
    originalFileSize: payload?.originalFileSize,
  }
}

/** Resolve which wallet wrap applies to the connected address (incl. legacy fields) */
export function findWalletKeyWrap(payload, connectedAddress) {
  const connected = normalizeEthAddress(connectedAddress)
  const wraps = Array.isArray(payload.keyWraps) ? payload.keyWraps : []
  const match = wraps.find(
    (w) =>
      w?.method === WRAP_METHOD_EIP712 &&
      typeof w.wallet === 'string' &&
      normalizeEthAddress(w.wallet) === connected,
  )
  if (match) return match

  // Legacy single-wrap fields (owner only)
  if (payload.walletEncryptedAesKey) {
    const owner = normalizeEthAddress(payload.encryptedByWallet || payload.walletAddress || '')
    if (owner === connected) {
      return {
        wallet: owner,
        method: WRAP_METHOD_EIP712,
        encryptedAesKey: payload.walletEncryptedAesKey,
        iv: payload.walletEncryptedAesKeyIv,
      }
    }
  }
  return null
}

export function listAuthorizedWallets(payload) {
  const set = new Set()
  if (payload.encryptedByWallet) {
    try {
      set.add(normalizeEthAddress(payload.encryptedByWallet))
    } catch {
      /* ignore */
    }
  }
  if (payload.walletAddress) {
    try {
      set.add(normalizeEthAddress(payload.walletAddress))
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(payload.authorizedWallets)) {
    for (const w of payload.authorizedWallets) {
      try {
        set.add(normalizeEthAddress(w))
      } catch {
        /* ignore */
      }
    }
  }
  if (Array.isArray(payload.keyWraps)) {
    for (const wrap of payload.keyWraps) {
      if (wrap?.wallet) {
        try {
          set.add(normalizeEthAddress(wrap.wallet))
        } catch {
          /* ignore */
        }
      }
    }
  }
  return [...set]
}

export function hasRecoveryPassphraseWrap(payload) {
  return payload?.recoveryWrap?.method === WRAP_METHOD_PASSPHRASE
}
