export async function requireSuccessfulReceipt(wait, config, parameters) {
  const receipt = await wait(config, { ...parameters, chainId: 84532 })
  if (receipt.status !== 'success') throw new Error(`TRANSACTION_REVERTED:${receipt.transactionHash || parameters.hash}`)
  return receipt
}
