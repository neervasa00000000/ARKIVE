import { bytesToBase64, base64ToBytes } from './security.js'

const DB_NAME = 'arkive-cache'
const STORE = 'arweave-content'
const DB_VERSION = 1

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * @param {string} txId
 * @returns {Promise<{ body: string, contentType: string, cachedAt: number } | undefined>}
 */
export async function getCachedContent(txId) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(txId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

export async function setCachedContent(txId, body, contentType) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(
        { body, contentType, cachedAt: Date.now() },
        txId,
      )
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Cache is best-effort
  }
}

/** Skip IndexedDB cache above this size (browser quota / memory). */
const LOCAL_CACHE_MAX_BYTES = 12 * 1024 * 1024

/** Cache raw bytes (vault bundles) for instant decrypt after upload. */
export async function setCachedBytes(txId, bytes, contentType = 'application/octet-stream') {
  if (bytes.length > LOCAL_CACHE_MAX_BYTES) {
    console.info('[ARKIVE] skip local cache — file too large for browser storage', bytes.length)
    return
  }
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(
        { bodyBase64: bytesToBase64(bytes), contentType, cachedAt: Date.now() },
        txId,
      )
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.warn('[ARKIVE] local cache failed (upload still ok)', error?.message || error)
  }
}

/**
 * @returns {Promise<{ bytes: Uint8Array, contentType: string } | undefined>}
 */
export async function getCachedBytes(txId) {
  const cached = await getCachedContent(txId)
  if (!cached?.bodyBase64) return undefined
  return {
    bytes: base64ToBytes(cached.bodyBase64),
    contentType: cached.contentType || 'application/octet-stream',
  }
}

// Turbo / Arweave gateways — skip hosts that often fail from browsers (g8way.io, ar-io.net).
const GATEWAYS = [
  (id) => `https://turbo-gateway.ar.io/${id}`,
  (id) => `https://turbo-gateway.com/${id}`,
  (id) => `https://arweave.net/${id}`,
]

function looksLikeHtmlError(bytes) {
  if (bytes.length < 5) return false
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(32, bytes.length))).toLowerCase()
  return head.includes('<html') || head.includes('<!doctype')
}

/** @returns {Promise<Uint8Array | null>} */
async function probeGatewayBytes(txId) {
  let saw404 = false
  for (const gateway of GATEWAYS) {
    try {
      const response = await fetch(gateway(txId), { redirect: 'follow' })
      if (response.status === 404) {
        saw404 = true
        continue
      }
      if (!response.ok) continue
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length === 0 || looksLikeHtmlError(bytes)) continue
      return bytes
    } catch {
      // try next gateway
    }
  }
  if (saw404) return null
  return null
}

async function fetchFromGateways(txId, parseResponse) {
  let saw404 = false
  let lastNetworkError
  const maxRounds = 4

  for (let round = 0; round < maxRounds; round++) {
    for (const gateway of GATEWAYS) {
      try {
        const response = await fetch(gateway(txId), { redirect: 'follow' })
        if (response.status === 404) {
          saw404 = true
          continue
        }
        if (!response.ok) continue
        const contentType = response.headers.get('content-type') || 'application/octet-stream'
        const parsed = await parseResponse(response, contentType)
        if (!parsed) continue
        return { ...parsed, contentType }
      } catch (err) {
        lastNetworkError = err
      }
    }
    if (round < maxRounds - 1) {
      await sleep(2500)
    }
  }

  if (saw404 && !lastNetworkError) {
    throw new Error('ARWEAVE_NOT_FOUND')
  }
  throw lastNetworkError || new Error('ARWEAVE_FETCH_FAILED')
}

/** Fire-and-forget gateway refresh after upload (does not block the UI). */
export function warmArweaveCacheInBackground(txId) {
  void (async () => {
    try {
      await waitForArweaveAvailability(txId, { maxAttempts: 8, delayMs: 3000 })
    } catch (error) {
      console.warn('[ARKIVE] background arweave warm', txId, error?.message || error)
    }
  })()
}

/**
 * Poll gateways until upload is readable (background / optional).
 * @param {string} txId
 * @param {{ maxAttempts?: number, delayMs?: number, onProgress?: (msg: string) => void }} [opts]
 */
export async function waitForArweaveAvailability(txId, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 18
  const delayMs = opts.delayMs ?? 5000
  const onProgress = opts.onProgress

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const bytes = await probeGatewayBytes(txId)
    if (bytes) {
      await setCachedBytes(txId, bytes)
      return
    }
    if (attempt < maxAttempts) {
      onProgress?.(`Waiting for Arweave to confirm (${attempt}/${maxAttempts})…`)
      await sleep(delayMs)
    }
  }

  throw new Error('ARWEAVE_VERIFY_FAILED')
}

/**
 * @returns {Promise<Uint8Array | null>} — for tests/diagnostics */
export async function probeArweaveBytes(txId) {
  return probeGatewayBytes(txId)
}

/** Single-pass gateway fetch (~3–8s max). Used when local cache is missing. */
export async function fetchArweaveBytesFast(txId) {
  const cached = await getCachedBytes(txId)
  if (cached) return cached

  let saw404 = false
  let lastNetworkError
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    for (const gateway of GATEWAYS) {
      try {
        const response = await fetch(gateway(txId), {
          redirect: 'follow',
          signal: controller.signal,
        })
        if (response.status === 404) {
          saw404 = true
          continue
        }
        if (!response.ok) continue
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.length === 0 || looksLikeHtmlError(bytes)) continue
        await setCachedBytes(txId, bytes)
        return { bytes, contentType: response.headers.get('content-type') || 'application/octet-stream' }
      } catch (err) {
        if (err?.name === 'AbortError') throw new Error('ARWEAVE_FETCH_TIMEOUT')
        lastNetworkError = err
      }
    }
  } finally {
    clearTimeout(timer)
  }

  if (saw404 && !lastNetworkError) throw new Error('ARWEAVE_NOT_FOUND')
  throw lastNetworkError || new Error('ARWEAVE_FETCH_FAILED')
}

/**
 * Fetch Arweave content with IndexedDB cache and gateway fallback.
 * @param {string} txId — validated Arweave transaction ID
 */
export async function fetchArweaveContent(txId) {
  const cached = await getCachedContent(txId)
  if (cached?.body) {
    return cached
  }

  const result = await fetchFromGateways(txId, async (response, contentType) => {
    const body = await response.text()
    if (!body) return null
    await setCachedContent(txId, body, contentType)
    return { body, cachedAt: Date.now() }
  })

  return result
}

/**
 * Fetch binary Arweave data (vault bundles). Local cache first, then fast gateway pass.
 * @param {string} txId
 */
export async function fetchArweaveBytes(txId) {
  const cached = await getCachedBytes(txId)
  if (cached) return cached
  return fetchArweaveBytesFast(txId)
}
