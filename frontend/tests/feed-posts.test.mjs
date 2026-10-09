import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeRecentPosts } from '../src/lib/feedPosts.js'

test('keeps just-published text when the chain feed replaces its pending record', () => {
  const pending = {
    id: 'pending-1', arweaveId: 'rid-1', contentType: 'text',
    _pending: true, _optimisticText: 'Hello from this wallet',
  }
  const confirmed = { id: 1n, arweaveId: 'rid-1', contentType: 'text' }
  const [post] = mergeRecentPosts([pending], [confirmed])
  assert.equal(post.id, 1n)
  assert.equal(post._optimisticText, 'Hello from this wallet')
  assert.equal(post._pending, undefined)
})
