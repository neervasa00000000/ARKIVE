let litClient = null

export async function getLitClient() {
  if (litClient) return litClient

  const [{ LitNodeClient }, { LIT_NETWORK }] = await Promise.all([
    import('@lit-protocol/lit-node-client'),
    import('@lit-protocol/constants'),
  ])

  litClient = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev,
    debug: false,
  })

  await litClient.connect()
  return litClient
}

export function buildAccessConditions(walletAddress) {
  return [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'baseSepolia',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: walletAddress.toLowerCase(),
      },
    },
  ]
}
