/**
 * App-sponsored feed storage — deployer pays Turbo when user credits / ETH path fails.
 * User still signs createPost on-chain; this endpoint only covers Arweave bytes.
 *
 * Env (server-only, never VITE_):
 *   DEPLOYER_PRIVATE_KEY — from contracts/.env
 *   SPONSOR_PORT — default 8787
 *   SPONSOR_MAX_BYTES — default 10MB (feed image cap)
 *
 * Production: deploy as serverless/Express with same env vars + rate limits.
 */
import http from 'node:http'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import {
  TurboFactory,
  ExistingBalanceFunding,
  defaultTurboConfiguration,
} from '@ardrive/turbo-sdk'
import { EthereumSigner } from '@dha-team/arbundles'
import { verifyMessage, isAddress } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { validateSponsorPayload } from '../src/lib/security.js'

const sponsorModuleDir = dirname(fileURLToPath(import.meta.url))
if (!process.env.DEPLOYER_PRIVATE_KEY?.trim()) {
  config({ path: resolve(sponsorModuleDir, '../../contracts/.env') })
  config({ path: resolve(sponsorModuleDir, '../.env') })
}

const PORT = Number(process.env.PORT || process.env.SPONSOR_PORT || 8787)
const HOST = process.env.SPONSOR_HOST || (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER ? '0.0.0.0' : '127.0.0.1')
const MAX_BYTES = Number(process.env.SPONSOR_MAX_BYTES || 10 * 1024 * 1024)
const AUTH_MAX_AGE_MS = 5 * 60 * 1000
const SPONSOR_AUTH_PREFIX = 'ARKIVE sponsor'

const CHAIN_RPC = {
  [baseSepolia.id]: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  [base.id]: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
}

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
  const headers = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
  }
  return headers
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes + 64 * 1024) {
        reject(new Error('BODY_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })
    req.on('error', reject)
  })
}

function decodePayload(dataB64) {
  if (!dataB64 || typeof dataB64 !== 'string') throw new Error('MISSING_DATA')
  const buf = Buffer.from(dataB64, 'base64')
  if (buf.length === 0) throw new Error('EMPTY_DATA')
  if (buf.length > MAX_BYTES) throw new Error('FILE_TOO_LARGE')
  return buf
}

async function verifySponsorAuth(walletAddress, timestamp, signature, payloadBytes) {
  if (!isAddress(walletAddress)) throw new Error('INVALID_WALLET')
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > AUTH_MAX_AGE_MS) {
    throw new Error('AUTH_EXPIRED')
  }
  const hash = createHash('sha256').update(payloadBytes).digest('hex')
  const message = `${SPONSOR_AUTH_PREFIX} ${ts} ${hash}`
  const ok = await verifyMessage({
    address: walletAddress,
    message,
    signature,
  })
  if (!ok) throw new Error('AUTH_INVALID')
}

function resolveChain(chainId) {
  const id = Number(chainId)
  if (id === base.id) return base
  if (id === baseSepolia.id) return baseSepolia
  throw new Error('UNSUPPORTED_CHAIN')
}

/** @type {{ turbo: import('@ardrive/turbo-sdk').TurboAuthenticatedClient, chainId: number } | null} */
let deployerTurboCache = null

async function getDeployerTurbo(chainId) {
  const pk = loadDeployerKey()
  if (!pk) throw new Error('SPONSOR_NOT_CONFIGURED')

  if (deployerTurboCache?.chainId === chainId) return deployerTurboCache.turbo

  const chain = resolveChain(chainId)
  const signer = new EthereumSigner(pk)
  const turbo = TurboFactory.authenticated({
    ...defaultTurboConfiguration,
    signer,
    token: 'base-eth',
    gatewayUrl: CHAIN_RPC[chain.id],
  })
  deployerTurboCache = { turbo, chainId }
  return turbo
}

async function sponsorUpload(body) {
  const {
    walletAddress,
    chainId = baseSepolia.id,
    byteCount,
    contentType = 'application/octet-stream',
    data,
    timestamp,
    signature,
  } = body

  const bytes = decodePayload(data)
  validateSponsorPayload(bytes, contentType, byteCount)

  await verifySponsorAuth(walletAddress, timestamp, signature, bytes)

  const walletKey = walletAddress.toLowerCase()
  if (!rateLimit(`wallet:${walletKey}`, RATE_MAX_PER_WALLET)) {
    throw new Error('RATE_LIMIT_WALLET')
  }

  const turbo = await getDeployerTurbo(Number(chainId))
  const response = await turbo.uploadFile({
    fileStreamFactory: () => bytes,
    fileSizeFactory: () => bytes.length,
    fundingMode: new ExistingBalanceFunding(),
    dataItemOpts: {
      tags: [
        { name: 'Content-Type', value: contentType },
        { name: 'App-Name', value: 'ARKIVE' },
        { name: 'App-Version', value: '2.3.0' },
        { name: 'Upload-Funding', value: 'base-eth-sponsor' },
        { name: 'Sponsor-For', value: walletKey },
      ],
    },
  })

  if (!response?.id) throw new Error('UPLOAD_NO_ID')
  return { arweaveId: response.id }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || ''
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    res.writeHead(origin && ALLOWED_ORIGINS.has(origin) ? 204 : 403, headers)
    res.end()
    return
  }

  const clientIp = req.socket.remoteAddress || 'unknown'

  if (req.url === '/api/turbo/sponsor-feed' && req.method === 'POST') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      res.writeHead(403, headers)
      res.end(JSON.stringify({ error: 'CORS_DENIED' }))
      return
    }
    if (!rateLimit(`ip:${clientIp}`, RATE_MAX_PER_IP)) {
      res.writeHead(429, headers)
      res.end(JSON.stringify({ error: 'RATE_LIMIT' }))
      return
    }

    try {
      const body = await readJsonBody(req, MAX_BYTES + 128 * 1024)
      console.info('[turboSponsor] sponsor-feed', {
        wallet: body.walletAddress?.slice(0, 10),
        bytes: body.byteCount,
        chainId: body.chainId,
      })
      const result = await sponsorUpload(body)
      console.info('[turboSponsor] upload ok', { id: result.arweaveId })
      res.writeHead(200, headers)
      res.end(JSON.stringify(result))
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
      res.writeHead(status, headers)
      res.end(JSON.stringify({ error: msg }))
    }
    return
  }

  if (req.url === '/api/turbo/health' && req.method === 'GET') {
    const configured = Boolean(loadDeployerKey())
    res.writeHead(200, headers)
    res.end(JSON.stringify({ ok: true, sponsorConfigured: configured }))
    return
  }

  res.writeHead(404, headers)
  res.end(JSON.stringify({ error: 'NOT_FOUND' }))
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!loadDeployerKey()) {
    console.warn('[turboSponsor] DEPLOYER_PRIVATE_KEY missing — sponsor uploads will return 503')
  }
  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      console.warn(`[turboSponsor] port ${PORT} already in use — another sponsor instance is running`)
      process.exit(0)
      return
    }
    console.error('[turboSponsor] server error', err)
    process.exit(1)
  })
  server.listen(PORT, HOST, () => {
    console.log(`[turboSponsor] listening on http://${HOST}:${PORT}`)
  })
}

export { server, sponsorUpload, verifySponsorAuth, SPONSOR_AUTH_PREFIX }
