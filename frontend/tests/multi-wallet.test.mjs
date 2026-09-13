import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConfig, createConnector, http, connect, disconnect, switchAccount, getAccount } from '@wagmi/core'
import { baseSepolia } from 'viem/chains'

for (const sameAddress of [false, true]) {
  test(`switching wallets preserves connector identity (same address: ${sameAddress})`, async () => {
    const addresses = ['0x' + '1'.repeat(40), '0x' + (sameAddress ? '1' : '2').repeat(40)]
    const connectors = addresses.map((address, i) => createConnector(() => ({
      id: `wallet-${i}`, name: `Wallet ${i}`, type: 'mock',
      connect: async () => ({ accounts: [address], chainId: baseSepolia.id }),
      disconnect: async () => {}, getProvider: async () => ({}),
      getAccounts: async () => [address], getChainId: async () => baseSepolia.id,
      isAuthorized: async () => true,
      onAccountsChanged() {}, onChainChanged() {}, onDisconnect() {},
    })))
    const config = createConfig({ chains: [baseSepolia], storage: null, connectors,
      transports: { [baseSepolia.id]: http() } })
    const [first, second] = config.connectors
    await connect(config, { connector: first })
    await connect(config, { connector: second })
    assert.equal(config.state.connections.size, 2)
    assert.equal(getAccount(config).connector.uid, second.uid)
    await switchAccount(config, { connector: first })
    assert.equal(getAccount(config).connector.uid, first.uid)
    assert.equal(getAccount(config).address, addresses[0])
    await disconnect(config, { connector: first })
    assert.equal(getAccount(config).connector.uid, second.uid)
    assert.equal(getAccount(config).status, 'connected')
    await disconnect(config, { connector: second })
    assert.equal(getAccount(config).status, 'disconnected')
  })
}

import { signWithSelectedWallet } from '../src/lib/selectedWalletSign.js'

test('signing uses the selected client even when another provider is installed', async () => {
  const previous = globalThis.window
  globalThis.window = { ethereum: { request: () => assert.fail('Default provider must not be called') } }
  try {
    const address = '0x' + '1'.repeat(40)
    const requests = []
    const client = { account: { address }, signMessage: async (request) => { requests.push(request); return 'selected-signature' } }
    assert.equal(await signWithSelectedWallet(client, 'hello'), 'selected-signature')
    assert.deepEqual(requests, [{ account: address, message: 'hello' }])
    const rejected = Object.assign(new Error('User rejected'), { code: 4001 })
    client.signMessage = async () => { throw rejected }
    await assert.rejects(signWithSelectedWallet(client, 'hello'), (error) => error === rejected)
    const timeout = new Error('WALLET_SIGN_TIMEOUT')
    client.signMessage = async () => { throw timeout }
    await assert.rejects(signWithSelectedWallet(client, 'hello'), (error) => error === timeout)
    assert.throws(() => signWithSelectedWallet({}, 'hello'), /WALLET_NOT_CONNECTED/)
  } finally { globalThis.window = previous }
})
