import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publishPost, readPendingPost, writePendingPost } from '../src/lib/postPublishing.js'
import { fetchFirstContent } from '../src/lib/gatewayFetch.js'

function publisher(overrides = {}) {
  const state = { checkpoint: { contentType: 'text', text: 'A message' }, uploads: 0, submissions: 0, confirmations: [] }
  const run = () => publishPost({
    checkpoint: state.checkpoint,
    upload: async () => { state.uploads++; return 'a'.repeat(43) },
    submit: async () => { state.submissions++; return '0x' + 'b'.repeat(64) },
    confirm: async (hash) => { state.confirmations.push(hash) },
    assertSession() {}, onStep() {}, onCheckpoint(value) { state.checkpoint = value },
    ...overrides,
  })
  return { state, run }
}

test('confirmation timeout resumes the same transaction without uploading or submitting again', async () => {
  let attempts = 0
  const { state, run } = publisher({ confirm: async (hash) => {
    state.confirmations.push(hash)
    if (++attempts === 1) throw new Error('RPC timeout')
  } })
  await assert.rejects(run(), /RPC timeout/)
  assert.ok(state.checkpoint.txHash)
  await run()
  assert.equal(state.uploads, 1)
  assert.equal(state.submissions, 1)
  assert.equal(state.confirmations[0], state.confirmations[1])
  assert.equal(state.checkpoint, null)
})
test('cancelled transaction resumes the completed upload', async () => {
  let attempts = 0
  const { state, run } = publisher({ submit: async () => {
    state.submissions++
    if (++attempts === 1) throw new Error('User rejected')
    return '0x' + 'c'.repeat(64)
  } })
  await assert.rejects(run(), /User rejected/)
  assert.equal(state.checkpoint.arweaveId, 'a'.repeat(43))
  await run()
  assert.equal(state.uploads, 1)
  assert.equal(state.submissions, 2)
})
test('a mined revert permits a new transaction while retaining the upload', async () => {
  let attempts = 0
  const { state, run } = publisher({ confirm: async () => {
    if (++attempts === 1) throw new Error('TRANSACTION_REVERTED:0x123')
  } })
  await assert.rejects(run(), /TRANSACTION_REVERTED/)
  assert.equal(state.checkpoint.txHash, undefined)
  await run()
  assert.equal(state.uploads, 1)
  assert.equal(state.submissions, 2)
})
test('upload failure never submits a feed transaction', async () => {
  const { state, run } = publisher({ upload: async () => { throw new Error('Storage unavailable') } })
  await assert.rejects(run(), /Storage unavailable/)
  assert.equal(state.submissions, 0)
})
test('wallet change after upload retains recovery metadata and stops submission', async () => {
  let checks = 0
  const { state, run } = publisher({ assertSession: () => { if (++checks === 2) throw new Error('WALLET_SESSION_CHANGED') } })
  await assert.rejects(run(), /WALLET_SESSION_CHANGED/)
  assert.equal(state.submissions, 0)
  assert.equal(state.checkpoint.arweaveId, 'a'.repeat(43))
})
test('pending posts survive reopening and are isolated by wallet', () => {
  const entries = new Map()
  const storage = { getItem: (key) => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) }
  const pending = { arweaveId: 'a'.repeat(43), contentType: 'text', text: 'Draft', txHash: '0x' + 'b'.repeat(64) }
  writePendingPost('wallet-a', pending, storage)
  assert.deepEqual(readPendingPost('wallet-a', storage), pending)
  assert.equal(readPendingPost('wallet-b', storage), null)
  writePendingPost('wallet-a', null, storage)
  assert.equal(readPendingPost('wallet-a', storage), null)
  writePendingPost('wallet-a', { ...pending, txHash: 'bad' }, storage)
  assert.equal(readPendingPost('wallet-a', storage), null)
  assert.doesNotThrow(() => writePendingPost('x', pending, { setItem() { throw new Error('denied') } }))
})

test('fast gateway wins and cancels a stalled gateway', async () => {
  let aborted = false
  const fetchFn = (url, { signal }) => url === 'fast' ? Promise.resolve(new Response('message')) : new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) }, { once: true })
  })
  assert.equal(await fetchFirstContent(['slow', 'fast'], (r) => r.text(), { fetchFn }), 'message')
  assert.equal(aborted, true)
})
test('invalid gateway content cannot win over a valid response', async () => {
  const fetchFn = async (url) => new Response(url === 'bad' ? '{}' : '{"text":"valid"}')
  const result = await fetchFirstContent(['bad', 'good'], async (r) => {
    const data = await r.json()
    return typeof data.text === 'string' ? data.text : null
  }, { fetchFn })
  assert.equal(result, 'valid')
})
test('missing content and deadline failures remain distinguishable', async () => {
  await assert.rejects(fetchFirstContent(['a', 'b'], (r) => r.text(), { fetchFn: async () => new Response('', { status: 404 }) }), /ARWEAVE_NOT_FOUND/)
  const fetchFn = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
  await assert.rejects(fetchFirstContent(['slow'], (r) => r.text(), { fetchFn, timeoutMs: 10 }), /ARWEAVE_FETCH_TIMEOUT/)
})
