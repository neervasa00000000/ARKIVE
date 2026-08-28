/**
 * Netlify serverless: /api/turbo/health + /api/turbo/sponsor-feed
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sponsorUpload } from '../../server/turboSponsor.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(rootDir, '../../../contracts/.env') })

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
const rateByKey = new Map()
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX_PER_IP = 30
const RATE_MAX_PER_WALLET = 15

function loadDeployerKey() {
  const fromEnv = process.env.DEPLOYER_PRIVATE_KEY?.trim()
  if (fromEnv && fromEnv !== 'your_private_key_here') return fromEnv
  return null
}

function rateLimit(key, max) {
  const now = Date.now()
  const entry = rateByKey.get(key)
  if (!entry || now > entry.resetAt) {
    rateByKey.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

function corsHeaders(origin) {
  const headers = { 'Content-Type': 'application/json', Vary: 'Origin' }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS, GET'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
  }
  return headers
}

function jsonResponse(status, body, origin) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) })
}

async function handleHealth(origin) {
  const configured = Boolean(loadDeployerKey())
  return jsonResponse(200, { ok: true, sponsorConfigured: configured }, origin)
}

async function handleSponsorFeed(req, origin, clientIp) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: origin && ALLOWED_ORIGINS.has(origin) ? 204 : 403,
      headers: corsHeaders(origin),
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED' }, origin)
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(403, { error: 'CORS_DENIED' }, origin)
  }

  if (!rateLimit(`ip:${clientIp}`, RATE_MAX_PER_IP)) {
    return jsonResponse(429, { error: 'RATE_LIMIT' }, origin)
  }

  try {
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (contentLength > MAX_BYTES + 128 * 1024) {
      return jsonResponse(413, { error: 'BODY_TOO_LARGE' }, origin)
    }

    const body = await req.json()
    const walletKey = body.walletAddress?.toLowerCase()
    if (walletKey && !rateLimit(`wallet:${walletKey}`, RATE_MAX_PER_WALLET)) {
      return jsonResponse(429, { error: 'RATE_LIMIT_WALLET' }, origin)
    }

    console.info('[turboSponsor] sponsor-feed', {
      wallet: body.walletAddress?.slice(0, 10),
      bytes: body.byteCount,
      chainId: body.chainId,
    })

    const result = await sponsorUpload(body)
    console.info('[turboSponsor] upload ok', { id: result.arweaveId })
    return jsonResponse(200, result, origin)
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
    return jsonResponse(status, { error: msg }, origin)
  }
}

export default async (req, context) => {
  const origin = req.headers.get('origin') || ''
  const path = new URL(req.url).pathname

  if (path.endsWith('/health')) {
    return handleHealth(origin)
  }

  if (path.endsWith('/sponsor-feed')) {
    const clientIp = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown'
    return handleSponsorFeed(req, origin, clientIp)
  }

  return jsonResponse(404, { error: 'NOT_FOUND' }, origin)
}
