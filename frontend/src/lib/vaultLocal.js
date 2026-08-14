/**
 * Local vault bundle cache — instant retrieve without waiting on Arweave gateways.
 */
import { getCachedBytes, setCachedBytes, fetchArweaveBytesFast } from './arweaveCache'
import { validateArweaveTxId } from './security'

export async function hasLocalVaultBundle(arweaveId) {
  try {
    const id = validateArweaveTxId(arweaveId)
    const cached = await getCachedBytes(id)
    return Boolean(cached?.bytes?.length)
  } catch {
    return false
  }
}

/** Local IndexedDB first, then one quick gateway pass (no multi-minute retries). */
export async function loadVaultBundleBytes(arweaveId) {
  const id = validateArweaveTxId(arweaveId)
  const cached = await getCachedBytes(id)
  if (cached?.bytes?.length) {
    return { bytes: cached.bytes, source: 'local' }
  }
  const { bytes } = await fetchArweaveBytesFast(id)
  return { bytes, source: 'arweave' }
}

export async function rememberVaultBundle(arweaveId, bundleBytes) {
  const id = validateArweaveTxId(arweaveId)
  await setCachedBytes(id, bundleBytes)
}
