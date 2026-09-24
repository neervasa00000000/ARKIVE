/** Optional local sponsor smoke test. It may spend test funds and is opt-in. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { SPONSOR_AUTH_PREFIX } from '../server/turboSponsor.mjs'

const enabled = process.env.RUN_SPONSOR_UPLOAD_SMOKE === 'true'
const sponsorEnabled = process.env.SPONSOR_ENABLED === 'true'
const privateKey = process.env.SPONSOR_PRIVATE_KEY?.trim()
const base = process.env.SPONSOR_SMOKE_URL?.replace(/\/$/, '')
const configured = enabled && sponsorEnabled && /^(0x)?[a-fA-F0-9]{64}$/.test(privateKey || '') && base
const skipReason = configured
  ? false
  : 'SKIPPED — ENVIRONMENT UNAVAILABLE: requires RUN_SPONSOR_UPLOAD_SMOKE=true, SPONSOR_ENABLED=true, SPONSOR_PRIVATE_KEY, SPONSOR_SMOKE_URL, and a running isolated sponsor server'

test('opt-in sponsor server accepts a signed synthetic upload', { skip: skipReason }, async () => {
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`)
  const healthResponse = await fetch(`${base}/api/turbo/health`)
  const health = await healthResponse.json()
  assert.equal(healthResponse.ok, true)
  assert.equal(health.sponsorConfigured, true)

  const payload = Buffer.from(JSON.stringify({ text: 'ARKIVE synthetic sponsor smoke test' }))
  const timestamp = Date.now()
  const hash = createHash('sha256').update(payload).digest('hex')
  const signature = await account.signMessage({
    message: `${SPONSOR_AUTH_PREFIX} ${timestamp} ${hash}`,
  })
  const response = await fetch(`${base}/api/turbo/sponsor-feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({
      walletAddress: account.address,
      chainId: 84532,
      byteCount: payload.length,
      contentType: 'application/json',
      data: payload.toString('base64'),
      timestamp,
      signature,
    }),
  })
  const result = await response.json()
  assert.equal(response.ok, true, result.error || 'sponsor upload failed')
  assert.match(result.arweaveId, /^[A-Za-z0-9_-]{43}$/)
})
