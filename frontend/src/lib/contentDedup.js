/**
 * Local content-address cache for feed image uploads — if this browser has
 * already paid to put these exact bytes on Arweave, reuse that transaction
 * ID instead of paying to upload the same content again.
 *
 * Scope, honestly: this only recognises re-uploads made from this browser,
 * by this wallet. It cannot see uploads from other devices/users — that
 * would need a shared on-chain or server-side index, which is a bigger,
 * separate change (adds a contract mapping + redeploy).
 */

const DEDUP_PREFIX = 'arkive_feed_dedup_'
const MAX_ENTRIES = 200

function cacheKey(walletAddress) {
  return DEDUP_PREFIX + walletAddress.toLowerCase()
}

function readCache(walletAddress) {
  try {
    const raw = localStorage.getItem(cacheKey(walletAddress))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeCache(walletAddress, cache) {
  try {
    const entries = Object.entries(cache)
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : cache
    localStorage.setItem(cacheKey(walletAddress), JSON.stringify(trimmed))
  } catch {
    /* localStorage unavailable/full — dedup is a pure optimization, safe to skip */
  }
}

export async function hashBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function findKnownUpload(walletAddress, hash) {
  if (!walletAddress || !hash) return null
  return readCache(walletAddress)[hash] || null
}

export function rememberUpload(walletAddress, hash, arweaveId) {
  if (!walletAddress || !hash || !arweaveId) return
  const cache = readCache(walletAddress)
  cache[hash] = arweaveId
  writeCache(walletAddress, cache)
}
