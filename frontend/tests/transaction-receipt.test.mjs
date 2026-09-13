import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireSuccessfulReceipt } from '../src/lib/transactionReceipt.js'
test('pins confirmation to Base Sepolia and returns confirmed receipt', async () => {
  const receipt = { status: 'success', transactionHash: '0x123' }
  assert.equal(await requireSuccessfulReceipt(async (_, params) => {
    assert.equal(params.chainId, 84532)
    return receipt
  }, {}, { hash: '0x123', chainId: 1 }), receipt)
})
test('rejects mined reverts instead of reporting success', async () => {
  await assert.rejects(requireSuccessfulReceipt(async () => ({ status: 'reverted' }), {}, { hash: '0x123' }), /TRANSACTION_REVERTED/)
})
test('preserves RPC timeout so a pending transaction is not treated as confirmed', async () => {
  await assert.rejects(requireSuccessfulReceipt(async () => { throw new Error('timeout') }, {}, {}), /timeout/)
})
