/** Keep signing bound to the captured wallet client and account, without retries. */
export function signWithSelectedWallet(walletClient, message) {
  const address = walletClient?.account?.address
  if (!address) throw new Error('WALLET_NOT_CONNECTED')
  return walletClient.signMessage({ account: address, message })
}
