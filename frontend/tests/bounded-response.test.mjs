import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readResponseBytes } from '../src/lib/boundedResponse.js'
test('reads small bodies exactly', async () => {
  assert.deepEqual(await readResponseBytes(new Response(new Uint8Array([1,2,3])), 3), new Uint8Array([1,2,3]))
})
test('rejects excessive content length', async () => {
  await assert.rejects(readResponseBytes(new Response('abc', { headers: { 'Content-Length': '100' } }), 10), /RESPONSE_TOO_LARGE/)
})
test('bounds chunked bodies without trusting advertised size', async () => {
  let cancelled = false
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5)); c.enqueue(new Uint8Array(6)) }, cancel() { cancelled = true } })
  await assert.rejects(readResponseBytes(new Response(stream, { headers: { 'Content-Length': '1' } }), 10), /RESPONSE_TOO_LARGE/)
  assert.equal(cancelled, true)
})
