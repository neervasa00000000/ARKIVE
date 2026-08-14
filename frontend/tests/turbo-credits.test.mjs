import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/** Mirrors turboUpload.js — keep in sync for credit-skip logic */
const FEED_SMALL_POST_MAX_BYTES = 10 * 1024

function estimateBundleByteCount(fileSize) {
  return Math.ceil(fileSize * 1.05) + 2048
}

function wincAtLeast(balanceWinc, neededWinc) {
  return BigInt(balanceWinc || '0') >= BigInt(neededWinc)
}

function isSmallFeedPost(byteCount, fast) {
  return fast === true && byteCount < FEED_SMALL_POST_MAX_BYTES
}

function hasAnyTurboCredits(balance) {
  return BigInt(balance?.effectiveBalance || '0') > 0n
}

function canSkipPaymentForSmallFeed(balance, byteCount, fast) {
  return isSmallFeedPost(byteCount, fast) && hasAnyTurboCredits(balance)
}

function creditsCoverUpload(balance, neededWinc, byteCount, fast) {
  return (
    wincAtLeast(balance?.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, fast)
  )
}

function bundleBytes(raw) {
  return estimateBundleByteCount(raw)
}

describe('turbo credits — image must not use partial balance', () => {
  it('estimateBundleByteCount adds bundle overhead', () => {
    assert.ok(estimateBundleByteCount(1_000_000) > 1_000_000)
  })

  it('full winc balance covers image upload — skip ETH', () => {
    const imageBytes = bundleBytes(500_000)
    const neededWinc = '5000000'
    const balance = { effectiveBalance: '5000000' }
    assert.equal(creditsCoverUpload(balance, neededWinc, imageBytes, true), true)
  })

  it('partial winc balance does not cover image — requires ETH', () => {
    const imageBytes = bundleBytes(500_000)
    const neededWinc = '5000000'
    const balance = { effectiveBalance: '1000' }
    assert.equal(creditsCoverUpload(balance, neededWinc, imageBytes, true), false)
  })

  it('any positive balance covers small text post — skip ETH', () => {
    const textBytes = bundleBytes(200)
    const neededWinc = '999999'
    const balance = { effectiveBalance: '1' }
    assert.ok(textBytes < FEED_SMALL_POST_MAX_BYTES)
    assert.equal(creditsCoverUpload(balance, neededWinc, textBytes, true), true)
  })

  it('image with sufficient credits never needs sendTransaction path', () => {
    const imageRaw = 2 * 1024 * 1024
    const imageBytes = bundleBytes(imageRaw)
    const neededWinc = '8000000'
    const balance = { effectiveBalance: '10000000' }
    assert.equal(creditsCoverUpload(balance, neededWinc, imageBytes, true), true)
  })
})
