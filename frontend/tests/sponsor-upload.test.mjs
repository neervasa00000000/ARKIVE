import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildSponsorAuthMessage, SPONSOR_AUTH_PREFIX } from '../src/lib/sponsorUpload.js'
import { sha256, bytesToHex } from 'viem'

/** Mirrors turboUpload.js isSponsorEligibleFailure */
function isSponsorEligibleFailure(error) {
  const msg = error?.shortMessage || error?.message || String(error)
  const lower = msg.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied')) return false
  if (msg === 'WALLET_NOT_CONNECTED') return false
  if (msg.startsWith('SPONSOR_UPLOAD_FAILED')) return false
  return true
}

describe('sponsor upload eligibility', () => {
  it('falls back on misrouted ETH / smart account payment', () => {
    assert.equal(isSponsorEligibleFailure(new Error('TURBO_FUND_WRONG_TX')), true)
  })

  it('falls back on insufficient credits', () => {
    assert.equal(isSponsorEligibleFailure({ message: 'insufficient balance', status: 402 }), true)
  })

  it('falls back on wallet sign timeout (smart account may succeed on sponsor path)', () => {
    assert.equal(isSponsorEligibleFailure(new Error('WALLET_SIGN_TIMEOUT')), true)
  })

  it('falls back on generic turbo upload timeout', () => {
    assert.equal(isSponsorEligibleFailure(new Error('TURBO_UPLOAD_TIMEOUT')), true)
  })

  it('does not fall back on user rejection', () => {
    assert.equal(isSponsorEligibleFailure(new Error('User rejected the request')), false)
  })

  it('does not fall back when wallet disconnected', () => {
    assert.equal(isSponsorEligibleFailure(new Error('WALLET_NOT_CONNECTED')), false)
  })

  it('does not loop on sponsor failure', () => {
    assert.equal(isSponsorEligibleFailure(new Error('SPONSOR_UPLOAD_FAILED:RATE_LIMIT')), false)
  })
})

describe('sponsor auth message', () => {
  it('binds signature to payload sha256 hash', () => {
    const bytes = new TextEncoder().encode('{"text":"hello"}')
    const ts = 1700000000000
    const hash = bytesToHex(sha256(bytes))
    assert.equal(buildSponsorAuthMessage(ts, bytes), `${SPONSOR_AUTH_PREFIX} ${ts} ${hash}`)
  })

  it('changes message when payload bytes change', () => {
    const ts = 1700000000000
    const a = buildSponsorAuthMessage(ts, new TextEncoder().encode('a'))
    const b = buildSponsorAuthMessage(ts, new TextEncoder().encode('b'))
    assert.notEqual(a, b)
  })
})
