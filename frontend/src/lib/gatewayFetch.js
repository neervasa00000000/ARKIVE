/** Race independent gateways within one deadline; cancel the losing requests. */
export async function fetchFirstContent(urls, parse, { fetchFn = globalThis.fetch, timeoutMs = 12_000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await Promise.any(urls.map(async (url) => {
      const response = await fetchFn(url, { redirect: 'follow', signal: controller.signal })
      if (!response.ok) throw new Error(`GATEWAY_HTTP_${response.status}`)
      const parsed = await parse(response)
      if (!parsed) throw new Error('GATEWAY_INVALID_CONTENT')
      return parsed
    }))
  } catch (error) {
    if (controller.signal.aborted) throw new Error('ARWEAVE_FETCH_TIMEOUT')
    if (error.errors?.every((item) => item.message === 'GATEWAY_HTTP_404')) throw new Error('ARWEAVE_NOT_FOUND')
    throw new Error('ARWEAVE_FETCH_FAILED')
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}
