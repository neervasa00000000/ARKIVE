import { isValidEthAddress, normalizeEthAddress } from './security.js'

export const MAX_TOTAL_WALLETS = 3
export const MAX_SECONDARY_WALLETS = MAX_TOTAL_WALLETS - 1 // 2

function storageKey(ownerAddress) {
  try {
    return `arkive_access_wallets_${normalizeEthAddress(ownerAddress)}`
  } catch {
    return null
  }
}

/**
 * Retrieve configured secondary/backup wallet addresses for an owner.
 * Returns at most MAX_SECONDARY_WALLETS (2) unique valid addresses.
 */
export function getConfiguredWallets(ownerAddress, storage = globalThis.localStorage) {
  if (!ownerAddress || !storage) return []
  const key = storageKey(ownerAddress)
  if (!key) return []
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalizedOwner = normalizeEthAddress(ownerAddress)
    const valid = []
    for (const item of parsed) {
      if (typeof item !== 'string' || !isValidEthAddress(item)) continue
      const norm = normalizeEthAddress(item)
      if (norm !== normalizedOwner && !valid.includes(norm)) {
        valid.push(norm)
      }
      if (valid.length >= MAX_SECONDARY_WALLETS) break
    }
    return valid
  } catch {
    return []
  }
}

/**
 * Save configured secondary/backup wallet addresses for an owner.
 */
export function saveConfiguredWallets(ownerAddress, wallets, storage = globalThis.localStorage) {
  if (!ownerAddress || !storage) return []
  const key = storageKey(ownerAddress)
  if (!key) return []
  const normalizedOwner = normalizeEthAddress(ownerAddress)
  const valid = []
  if (Array.isArray(wallets)) {
    for (const item of wallets) {
      if (typeof item !== 'string' || !isValidEthAddress(item)) continue
      const norm = normalizeEthAddress(item)
      if (norm !== normalizedOwner && !valid.includes(norm)) {
        valid.push(norm)
      }
      if (valid.length >= MAX_SECONDARY_WALLETS) break
    }
  }
  storage.setItem(key, JSON.stringify(valid))
  return valid
}

/**
 * Add a secondary wallet for an owner.
 */
export function addConfiguredWallet(ownerAddress, secondaryAddress, storage = globalThis.localStorage) {
  if (!isValidEthAddress(secondaryAddress)) {
    throw new Error('INVALID_ETH_ADDRESS')
  }
  const normalizedOwner = normalizeEthAddress(ownerAddress)
  const normSecondary = normalizeEthAddress(secondaryAddress)
  if (normalizedOwner === normSecondary) {
    throw new Error('CANNOT_ADD_OWNER_AS_BACKUP')
  }
  const current = getConfiguredWallets(ownerAddress, storage)
  if (current.includes(normSecondary)) {
    return current
  }
  if (current.length >= MAX_SECONDARY_WALLETS) {
    throw new Error('MAX_WALLETS_REACHED')
  }
  current.push(normSecondary)
  saveConfiguredWallets(ownerAddress, current, storage)
  return current
}

/**
 * Remove a secondary wallet for an owner.
 */
export function removeConfiguredWallet(ownerAddress, secondaryAddress, storage = globalThis.localStorage) {
  const normSecondary = normalizeEthAddress(secondaryAddress)
  const current = getConfiguredWallets(ownerAddress, storage)
  const filtered = current.filter((addr) => addr !== normSecondary)
  saveConfiguredWallets(ownerAddress, filtered, storage)
  return filtered
}
