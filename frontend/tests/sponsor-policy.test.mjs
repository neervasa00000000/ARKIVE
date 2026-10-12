import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadSponsorKey, createBoundedRateLimiter } from '../server/sponsorPolicy.mjs'
const key = '1'.repeat(64)
test('deployer key never implicitly enables sponsorship', () => {
  assert.equal(loadSponsorKey({ DEPLOYER_PRIVATE_KEY: key }), null)
  assert.equal(loadSponsorKey({ SPONSOR_ENABLED: 'true', SPONSOR_PRIVATE_KEY: key, DEPLOYER_PRIVATE_KEY: key }), null)
})
test('dedicated sponsorship is explicit and refused on public deployments', () => {
  const env = { SPONSOR_ENABLED: 'true', SPONSOR_PRIVATE_KEY: key }
  assert.equal(loadSponsorKey(env), key)
  for (const host of ['VERCEL','NETLIFY','RENDER','RAILWAY_ENVIRONMENT']) assert.equal(loadSponsorKey({ ...env, [host]: '1' }), null)
  assert.equal(loadSponsorKey({ ...env, NODE_ENV: 'production' }), null)
})
test('rate limiter bounds memory and reclaims expired windows', () => {
  let now = 0
  const limit = createBoundedRateLimiter({ maxKeys: 2, windowMs: 100, now: () => now })
  assert.equal(limit('a', 1), true)
  assert.equal(limit('a', 1), false)
  assert.equal(limit('b', 1), true)
  assert.equal(limit('c', 1), false)
  now = 100
  assert.equal(limit('c', 1), true)
})

test('request size limit accommodates the full supported Base64 payload', async () => {
  const { sponsorBodyLimit } = await import('../server/sponsorPolicy.mjs')
  const bytes = 10 * 1024 * 1024
  const encodedSize = Math.ceil(bytes / 3) * 4
  assert.ok(sponsorBodyLimit(bytes) >= encodedSize + 1024)
  assert.ok(sponsorBodyLimit(bytes) < 14 * 1024 * 1024)
})
test('health does not advertise a public sponsor from deployer credentials', async () => {
  const { default: health } = await import('../api/turbo/health.js')
  const body = await (await health(new Request('https://example.test/api/turbo/health'))).json()
  assert.equal(body.sponsorConfigured, false)
  assert.equal(body.uploadMode, 'wallet')
  assert.equal(body.chainId, 84532)
})
