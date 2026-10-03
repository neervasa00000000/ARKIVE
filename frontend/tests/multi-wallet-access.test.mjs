import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_TOTAL_WALLETS,
  MAX_SECONDARY_WALLETS,
  getConfiguredWallets,
  saveConfiguredWallets,
  addConfiguredWallet,
  removeConfiguredWallet,
} from '../src/lib/multiWalletAccess.js'

function createMockStorage() {
  const map = new Map()
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
  }
}

test('multiWalletAccess bounds total wallets to 3 (1 primary + 2 secondary)', () => {
  assert.equal(MAX_TOTAL_WALLETS, 3)
  assert.equal(MAX_SECONDARY_WALLETS, 2)
})

test('manages configured secondary wallets in storage', () => {
  const storage = createMockStorage()
  const owner = '0x1111111111111111111111111111111111111111'
  const wallet2 = '0x2222222222222222222222222222222222222222'
  const wallet3 = '0x3333333333333333333333333333333333333333'
  const wallet4 = '0x4444444444444444444444444444444444444444'

  assert.deepEqual(getConfiguredWallets(owner, storage), [])

  // Add wallet 2
  const step1 = addConfiguredWallet(owner, wallet2, storage)
  assert.deepEqual(step1, [wallet2.toLowerCase()])

  // Add wallet 3 (reaches max 2 secondaries, so 3 total)
  const step2 = addConfiguredWallet(owner, wallet3, storage)
  assert.deepEqual(step2, [wallet2.toLowerCase(), wallet3.toLowerCase()])

  // Attempting to add 4th wallet fails
  assert.throws(() => addConfiguredWallet(owner, wallet4, storage), {
    message: 'MAX_WALLETS_REACHED',
  })

  // Cannot add owner as backup
  assert.throws(() => addConfiguredWallet(owner, owner, storage), {
    message: 'CANNOT_ADD_OWNER_AS_BACKUP',
  })

  // Adding duplicate does not duplicate
  const step3 = addConfiguredWallet(owner, wallet2, storage)
  assert.deepEqual(step3, [wallet2.toLowerCase(), wallet3.toLowerCase()])

  // Remove wallet 2
  const step4 = removeConfiguredWallet(owner, wallet2, storage)
  assert.deepEqual(step4, [wallet3.toLowerCase()])

  // Can now add wallet 4
  const step5 = addConfiguredWallet(owner, wallet4, storage)
  assert.deepEqual(step5, [wallet3.toLowerCase(), wallet4.toLowerCase()])
})
