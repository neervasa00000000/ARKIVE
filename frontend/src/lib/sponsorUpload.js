/**
 * Client for app-sponsored feed uploads.
 * User signs EIP-191 "ARKIVE sponsor {timestamp} {sha256(data)}" — server pays Turbo storage.
 * On-chain createPost still uses the user's wallet.
 */
import { bytesToHex, isHex, sha256, stringToHex } from 'viem'
import { validateArweaveTxId } from './security.js'
import { warmArweaveCacheInBackground } from './arweaveCache.js'

export const SPONSOR_AUTH_PREFIX = 'ARKIVE sponsor'

/** Production: set VITE_SPONSOR_API_URL to sponsor server origin (no trailing slash). Dev uses Vite proxy. */
function sponsorApiBase() {
  const base = import.meta.env.VITE_SPONSOR_API_URL?.trim().replace(/\/$/, '')
  return base || ''
}

function sponsorUrl(path) {
  const base = sponsorApiBase()
  return base ? `${base}${path}` : path
}

const SPONSOR_ENDPOINT = () => sponsorUrl('/api/turbo/sponsor-feed')
const SPONSOR_HEALTH_ENDPOINT = () => sponsorUrl('/api/turbo/health')
const SIGN_TIMEOUT_MS = 90_000
const METAMASK_PROMPT_TIMEOUT_MS = 60_000

function toUploadBytes(data) {
  if (data instanceof File || data instanceof Blob) {
    throw new Error('Pass ArrayBuffer or Uint8Array — read File before calling sponsor upload')
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data)
  }
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

function bytesToBase64(bytes) {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function withTimeout(promise, ms, code) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(code)), ms)
    }),
  ])
}

function toRawBytes(message) {
  if (message instanceof Uint8Array) return message
  return new Uint8Array(message)
}

function normalizeSignature(sig) {
  if (!sig || typeof sig !== 'string') throw new Error('WALLET_BAD_SIGNATURE')
  if (isHex(sig)) return sig
  if (/^[0-9a-fA-F]{130}$/.test(sig)) return `0x${sig}`
  throw new Error('WALLET_BAD_SIGNATURE')
}

function messageToPersonalSignHex(message) {
  if (typeof message === 'string') return stringToHex(message)
  return bytesToHex(toRawBytes(message))
}

function isUserRejectedSign(error) {
  const text = String(error?.message || error?.cause?.message || error || '').toLowerCase()
  return text.includes('user rejected') || text.includes('user denied') || text.includes('rejected the request')
}

/** Build payload-bound sponsor auth message (shared with server verification). */
export function buildSponsorAuthMessage(timestamp, bytes) {
  const hash = bytesToHex(sha256(bytes))
  return `${SPONSOR_AUTH_PREFIX} ${timestamp} ${hash}`
}

/** Smart accounts often ignore viem signMessage — fall back to personal_sign like turboUpload.js */
async function signSponsorAuth(walletClient, bytes) {
  const timestamp = Date.now()
  const message = buildSponsorAuthMessage(timestamp, bytes)
  const address = walletClient.account.address

  console.info('[ARKIVE sponsor] requesting auth signature', { address, timestamp })

  const signViaWalletClient = () =>
    withTimeout(
      walletClient.signMessage({ account: address, message }),
      METAMASK_PROMPT_TIMEOUT_MS,
      'WALLET_SIGN_TIMEOUT',
    )

  const signViaEthereum = async (signerAddress) => {
    const provider = typeof window !== 'undefined' ? window.ethereum : null
    if (!provider?.request) throw new Error('WALLET_NOT_CONNECTED')
    const hex = messageToPersonalSignHex(message)
    return withTimeout(
      provider.request({
        method: 'personal_sign',
        params: [hex, signerAddress],
      }),
      METAMASK_PROMPT_TIMEOUT_MS,
      'WALLET_SIGN_TIMEOUT',
    )
  }

  let signature
  try {
    signature = normalizeSignature(await signViaWalletClient())
  } catch (firstError) {
    if (isUserRejectedSign(firstError)) throw firstError
    try {
      signature = normalizeSignature(await signViaEthereum(address))
    } catch (secondError) {
      if (isUserRejectedSign(secondError)) throw secondError
      const provider = typeof window !== 'undefined' ? window.ethereum : null
      const accounts = provider?.request
        ? await provider.request({ method: 'eth_accounts' }).catch(() => [])
        : []
      const owner = accounts?.[0]
      if (owner && owner.toLowerCase() !== address.toLowerCase()) {
        signature = normalizeSignature(await signViaEthereum(owner))
      } else {
        throw secondError
      }
    }
  }

  console.info('[ARKIVE sponsor] auth signature ok')
  return { timestamp, signature, walletAddress: address }
}

/** Warm-check sponsor API — logs warning when dev proxy target is down. */
export async function checkSponsorHealth() {
  try {
    const res = await fetch(SPONSOR_HEALTH_ENDPOINT(), { method: 'GET' })
    const payload = await res.json().catch(() => ({}))
    const ok = res.ok && payload?.ok === true
    console.info('[ARKIVE sponsor] health', { ok, configured: payload?.sponsorConfigured })
    return { ok, configured: Boolean(payload?.sponsorConfigured) }
  } catch (error) {
    console.warn('[ARKIVE sponsor] health check failed — sponsor fallback unavailable', error?.message || error)
    return { ok: false, configured: false }
  }
}

/**
 * Upload feed bytes via deployer-sponsored Turbo storage.
 * @returns {Promise<string>} Arweave transaction id
 */
export async function sponsorFeedUpload(walletClient, data, opts = {}) {
  if (!walletClient?.account?.address) {
    throw new Error('WALLET_NOT_CONNECTED')
  }

  const bytes = toUploadBytes(data)
  const chainId = walletClient.chain?.id ?? 84532
  opts.onStep?.('Uploading…')

  console.info('[ARKIVE sponsor] feed upload start', {
    bytes: bytes.length,
    chainId,
    contentType: opts.contentType || 'application/octet-stream',
  })

  const { timestamp, signature, walletAddress } = await signSponsorAuth(walletClient, bytes)

  let res
  try {
    res = await fetch(SPONSOR_ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        chainId,
        byteCount: bytes.length,
        contentType: opts.contentType || 'application/octet-stream',
        data: bytesToBase64(bytes),
        timestamp,
        signature,
      }),
    })
  } catch (networkError) {
    console.error('[ARKIVE sponsor] network error', networkError)
    throw new Error('SPONSOR_UPLOAD_FAILED:NETWORK_ERROR')
  }

  const rawBody = await res.text().catch(() => '')
  let payload = {}
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    payload = {}
  }
  if (!res.ok) {
    let code = payload?.error || `SPONSOR_HTTP_${res.status}`
    if (
      /FUNCTION_INVOCATION_FAILED|ERR_REQUIRE_ESM|uuid\/dist-node/i.test(rawBody) ||
      (!payload?.error && res.status >= 500)
    ) {
      code = 'FUNCTION_INVOCATION_FAILED'
    }
    console.error('[ARKIVE sponsor] upload rejected', { status: res.status, code })
    throw new Error(`SPONSOR_UPLOAD_FAILED:${code}`)
  }

  const arweaveId = validateArweaveTxId(payload.arweaveId)
  warmArweaveCacheInBackground(arweaveId)
  console.info('[ARKIVE sponsor] feed upload ok', { id: arweaveId, bytes: bytes.length })
  return arweaveId
}
