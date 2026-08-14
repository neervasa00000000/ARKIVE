/**
 * Live sponsor API smoke test — requires contracts/.env DEPLOYER_PRIVATE_KEY.
 * Run: node tests/sponsor-live.test.mjs
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { SPONSOR_AUTH_PREFIX, sponsorUpload, verifySponsorAuth } from '../server/turboSponsor.mjs'

function sponsorAuthMessage(timestamp, payloadBytes) {
  const hash = createHash('sha256').update(payloadBytes).digest('hex')
  return `${SPONSOR_AUTH_PREFIX} ${timestamp} ${hash}`
}

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../contracts/.env') })

const PORT = Number(process.env.SPONSOR_PORT || 8787)
const BASE = `http://127.0.0.1:${PORT}`

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY?.trim()
  if (!pk || pk === 'your_private_key_here') {
    console.error('SKIP: DEPLOYER_PRIVATE_KEY not set in contracts/.env')
    process.exit(0)
  }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
  const healthRes = await fetch(`${BASE}/api/turbo/health`)
  const health = await healthRes.json()
  console.info('[sponsor-live] health', health)
  if (!healthRes.ok || !health.sponsorConfigured) {
    throw new Error('Sponsor health check failed — start: node server/turboSponsor.mjs')
  }

  const payload = Buffer.from(JSON.stringify({ text: 'ARKIVE sponsor live test' }), 'utf8')
  const dataB64 = payload.toString('base64')

  const timestamp = Date.now()
  const message = sponsorAuthMessage(timestamp, payload)
  const signature = await account.signMessage({ message })
  await verifySponsorAuth(account.address, timestamp, signature, payload)

  const direct = await sponsorUpload({
    walletAddress: account.address,
    chainId: 84532,
    byteCount: payload.length,
    contentType: 'application/json',
    data: dataB64,
    timestamp,
    signature,
  })
  console.info('[sponsor-live] direct upload ok', direct.arweaveId)

  const httpTimestamp = Date.now()
  const httpMessage = sponsorAuthMessage(httpTimestamp, payload)
  const httpSignature = await account.signMessage({ message: httpMessage })

  const curlBody = JSON.stringify({
    walletAddress: account.address,
    chainId: 84532,
    byteCount: payload.length,
    contentType: 'application/json',
    data: dataB64,
    timestamp: httpTimestamp,
    signature: httpSignature,
  })

  const httpRes = await fetch(`${BASE}/api/turbo/sponsor-feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: curlBody,
  })
  const httpPayload = await httpRes.json()
  if (!httpRes.ok) {
    throw new Error(`HTTP sponsor failed: ${httpPayload.error || httpRes.status}`)
  }
  console.info('[sponsor-live] HTTP upload ok', httpPayload.arweaveId)
}

main().catch((err) => {
  console.error('[sponsor-live] FAILED', err.message || err)
  process.exit(1)
})
