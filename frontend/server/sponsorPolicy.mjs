/** Testnet-only prototype. Public/multi-instance sponsorship needs durable quotas. */
export function loadSponsorKey(env = process.env) {
  if (env.SPONSOR_ENABLED !== 'true') return null
  // Fail closed on public deployment: in-memory replay and quotas are insufficient there.
  if (env.NODE_ENV === 'production' || env.VERCEL || env.NETLIFY || env.RENDER || env.RAILWAY_ENVIRONMENT) return null
  const key = env.SPONSOR_PRIVATE_KEY?.trim()
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(key || '')) return null
  if (key.replace(/^0x/, '').toLowerCase() === env.DEPLOYER_PRIVATE_KEY?.replace(/^0x/, '').toLowerCase()) return null
  return key
}
export function createBoundedRateLimiter({ windowMs = 3600000, maxKeys = 10000, now = Date.now } = {}) {
  const entries = new Map()
  return (key, limit) => {
    const time = now()
    for (const [id, entry] of entries) if (entry.resetAt <= time) entries.delete(id)
    const entry = entries.get(key)
    if (!entry) {
      if (entries.size >= maxKeys) return false
      entries.set(key, { count: 1, resetAt: time + windowMs })
      return true
    }
    if (entry.count >= limit) return false
    entry.count++
    return true
  }
}
