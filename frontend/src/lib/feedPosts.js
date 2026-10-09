/** Preserve submitted text while a new post propagates to storage gateways. */
export function mergeRecentPosts(previousPosts, recentPosts) {
  const optimisticTextById = new Map(
    previousPosts.filter((post) => post._optimisticText).map((post) => [post.arweaveId, post._optimisticText]),
  )
  const chainPosts = [...recentPosts].reverse().map((post) => ({
    ...post,
    ...(optimisticTextById.has(post.arweaveId)
      ? { _optimisticText: optimisticTextById.get(post.arweaveId) }
      : {}),
  }))
  const chainIds = new Set(chainPosts.map((post) => post.arweaveId))
  const stillPending = previousPosts.filter((post) => post._pending && !chainIds.has(post.arweaveId))
  return [...stillPending, ...chainPosts]
}
