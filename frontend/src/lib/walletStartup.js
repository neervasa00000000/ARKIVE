/** Wagmi uses both states during startup, depending on whether a connection was persisted. */
export function isWalletRestoring(status) {
  return status === 'connecting' || status === 'reconnecting'
}
