import { loadSponsorKey, createBoundedRateLimiter } from '../../server/sponsorPolicy.mjs'
/**
 * Shared sponsor handlers for Vercel serverless (/api/turbo/*).
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sponsorUpload } from '../../server/turboSponsor.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))

const MAX_BYTES = Number(process.env.SPONSOR_MAX_BYTES || 10 * 1024 * 1024)

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://arkive-beta.vercel.app',
  'https://arkive-beta.netlify.app',
]

function loadAllowedOrigins() {
  const extra = (process.env.SPONSOR_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return new Set([...DEFAULT_ORIGINS, ...extra])
}

const ALLOWED_ORIGINS = loadAllowedOrigins()

/** @type {Map<string, { count: number, resetAt: number }>} */
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX_PER_IP = 30
const RATE_MAX_PER_WALLET = 15

function loadDeployerKey() { return loadSponsorKey() }

const rateLimit = createBoundedRateLimiter()

export function corsHeaders(origin) {
  const headers = { 'Content-Type': 'application/json', Vary: 'Origin' }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS, GET'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
  }
  return headers
}

export function sendJson(res, status, body, origin) {
  res.status(status).setHeader('Content-Type', 'application/json')
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    if (key !== 'Content-Type') res.setHeader(key, value)
  }
  res.json(body)
}

export async function handleHealth(req, res) {
  const origin = req.headers.origin || ''
  const configured = Boolean(loadDeployerKey())
  sendJson(res, 200, { ok: true, sponsorConfigured: configured }, origin)
}

export async function handleSponsorFeed(req, res) {
  const origin = req.headers.origin || ''
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'

  if (req.method === 'OPTIONS') {
    const status = origin && ALLOWED_ORIGINS.has(origin) ? 204 : 403
    res.status(status)
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      res.setHeader(key, value)
    }
    return res.end()
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' }, origin)
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return sendJson(res, 403, { error: 'CORS_DENIED' }, origin)
  }

  if (!rateLimit(`ip:${clientIp}`, RATE_MAX_PER_IP)) {
    return sendJson(res, 429, { error: 'RATE_LIMIT' }, origin)
  }

  try {
    const contentLength = Number(req.headers['content-length'] || 0)
    if (contentLength > MAX_BYTES + 128 * 1024) {
      return sendJson(res, 413, { error: 'BODY_TOO_LARGE' }, origin)
    }

    const body = req.body
    const walletKey = typeof body?.walletAddress === 'string' ? body.walletAddress.toLowerCase() : null
    if (walletKey && !rateLimit(`wallet:${walletKey}`, RATE_MAX_PER_WALLET)) {
      return sendJson(res, 429, { error: 'RATE_LIMIT_WALLET' }, origin)
    }

    console.info('[turboSponsor] sponsor-feed', {
      wallet: body.walletAddress?.slice(0, 10),
      bytes: body.byteCount,
      chainId: body.chainId,
    })

    const result = await sponsorUpload(body)
    console.info('[turboSponsor] upload ok', { id: result.arweaveId })
    return sendJson(res, 200, result, origin)
  } catch (error) {
    const msg = error?.message || String(error)
    const status =
      msg === 'BODY_TOO_LARGE' || msg === 'FILE_TOO_LARGE'
        ? 413
        : msg === 'CONTENT_TYPE_BLOCKED' || msg === 'FILE_CONTENT_MISMATCH'
          ? 415
          : msg === 'RATE_LIMIT_WALLET' || msg === 'RATE_LIMIT'
            ? 429
            : msg === 'SPONSOR_NOT_CONFIGURED'
              ? 503
              : msg.startsWith('AUTH_') || msg === 'INVALID_WALLET'
                ? 401
                : 400
    return sendJson(res, status, { error: msg }, origin)
  }
}
