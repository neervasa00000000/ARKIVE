/**
 * Turbo funding helpers — bundle byte estimate used for credit checks.
 * Run: node --test tests/turbo-upload-funding.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

function estimateBundleByteCount(fileSize) {
  return Math.ceil(fileSize * 1.05) + 2048
}

test('estimateBundleByteCount adds bundle overhead', () => {
  assert.equal(estimateBundleByteCount(100), Math.ceil(100 * 1.05) + 2048)
  assert.ok(estimateBundleByteCount(500) > 500)
})

test('small feed text stays under 10KB threshold with overhead', () => {
  const raw = new TextEncoder().encode(JSON.stringify({ text: 'hello', timestamp: 1 })).length
  assert.ok(estimateBundleByteCount(raw) < 10 * 1024)
})
