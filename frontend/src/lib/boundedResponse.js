/** Bound untrusted response bodies even when Content-Length is absent or dishonest. */
export async function readResponseBytes(response, maxBytes) {
  const length = Number(response.headers.get('content-length'))
  if (length > maxBytes) {
    await response.body?.cancel()
    throw new Error('RESPONSE_TOO_LARGE')
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error('RESPONSE_TOO_LARGE')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}
