import { normalizeEthAddress } from './security.js'

/** Reject results from a wallet that is no longer the active account/connector. */
export function assertWalletSession(address, connectorUid, walletClient, activeAccount) {
  if (!address || !walletClient?.account?.address || !activeAccount?.address) {
    throw new Error('WALLET_NOT_CONNECTED')
  }
  const expected = normalizeEthAddress(address)
  if (
    normalizeEthAddress(walletClient.account.address) !== expected ||
    normalizeEthAddress(activeAccount.address) !== expected ||
    (connectorUid && activeAccount.connector?.uid !== connectorUid)
  ) {
    throw new Error('WALLET_SESSION_CHANGED')
  }
}
