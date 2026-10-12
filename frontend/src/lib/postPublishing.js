/** A post has two independent writes: storage, then the feed transaction.
 * Keep both identifiers so retrying never repeats a successful or pending write.
 */
export async function publishPost({ checkpoint, upload, submit, confirm, onCheckpoint, onStep, assertSession }) {
  let current = { ...checkpoint }
  const save = () => onCheckpoint({ ...current })
  assertSession()
  if (!current.arweaveId) {
    onStep('Uploading…')
    current.arweaveId = await upload()
    save()
  }
  assertSession()
  if (!current.txHash) {
    onStep('Approve post in your wallet…')
    current.txHash = await submit(current)
    save()
  }
  onStep('Confirming post…')
  try {
    await confirm(current.txHash)
  } catch (error) {
    // Only a mined revert permits a new transaction. An RPC failure is ambiguous.
    if (error?.message?.startsWith('TRANSACTION_REVERTED:')) {
      delete current.txHash
      save()
    }
    throw error
  }
  onCheckpoint(null)
  return current
}

const PREFIX = 'arkive.pending-post.v1:'
export function readPendingPost(key, storage) {
  try {
    storage ??= globalThis.sessionStorage
    const value = JSON.parse(storage?.getItem(PREFIX + key) || 'null')
    if (!value || !/^[a-zA-Z0-9_-]{43}$/.test(value.arweaveId || '')) return null
    if (!['text', 'image'].includes(value.contentType)) return null
    if (value.txHash && !/^0x[0-9a-fA-F]{64}$/.test(value.txHash)) return null
    return { arweaveId: value.arweaveId, contentType: value.contentType,
      text: typeof value.text === 'string' ? value.text.slice(0, 2000) : undefined,
      txHash: value.txHash }
  } catch { return null }
}
export function writePendingPost(key, value, storage) {
  try {
    storage ??= globalThis.sessionStorage
    if (value) storage?.setItem(PREFIX + key, JSON.stringify(value))
    else storage?.removeItem(PREFIX + key)
  } catch { /* In-memory recovery remains available if session storage is unavailable. */ }
}
