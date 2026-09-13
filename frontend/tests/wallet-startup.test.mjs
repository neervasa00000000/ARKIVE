import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConfig, http, createConnector, reconnect } from '@wagmi/core'
import { baseSepolia } from 'viem/chains'
import { isWalletRestoring } from '../src/lib/walletStartup.js'

for (const persisted of [false, true]) {
  test(`wallet restoration does not expose signed-out UI (persisted=${persisted})`, async () => {
    const config = createConfig({ chains: [baseSepolia], storage: null, transports: { [baseSepolia.id]: http() }, connectors: [createConnector(() => ({ id: 'test', name: 'Test wallet', type: 'test', getProvider: async () => ({}), isAuthorized: async () => true, connect: async () => ({ accounts: ['0x' + '1'.repeat(40)], chainId: baseSepolia.id }), onAccountsChanged() {}, onChainChanged() {}, onDisconnect() {} }))] })
    if (persisted) config.setState((state) => ({ ...state, current: config.connectors[0].uid }))
    const states = []
    const unsubscribe = config.subscribe((state) => state.status, (status) => states.push(status))
    const pending = reconnect(config)
    assert.equal(isWalletRestoring(config.state.status), true)
    await pending
    unsubscribe()
    assert.equal(config.state.status, 'connected')
    assert.ok(states.includes(persisted ? 'reconnecting' : 'connecting'))
    assert.ok(!states.includes('disconnected'))
  })
}

test('no saved wallet settles to disconnected instead of leaving an endless loader', async () => {
  const config = createConfig({ chains: [baseSepolia], storage: null, transports: { [baseSepolia.id]: http() }, connectors: [] })
  await reconnect(config)
  assert.equal(config.state.status, 'disconnected')
  assert.equal(isWalletRestoring(config.state.status), false)
})
