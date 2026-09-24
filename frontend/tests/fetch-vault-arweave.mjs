/** Optional external-network smoke test. No live transaction is hard-coded. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probeArweaveBytes } from '../src/lib/arweaveCache.js'
import { isVaultBundleBytes } from '../src/lib/vaultBundle.js'
import { validateArweaveTxId } from '../src/lib/security.js'

const txId = process.env.ARKIVE_SMOKE_ARWEAVE_TX_ID?.trim()
const skipReason = txId
  ? false
  : 'SKIPPED — ENVIRONMENT UNAVAILABLE: set ARKIVE_SMOKE_ARWEAVE_TX_ID to a synthetic/public v3 fixture transaction'

test('external Arweave gateway can retrieve a configured v3 fixture', { skip: skipReason }, async () => {
  assert.equal(validateArweaveTxId(txId), txId)
  const bytes = await probeArweaveBytes(txId)
  assert.ok(bytes, 'configured transaction was unavailable through all tested gateways')
  assert.ok(isVaultBundleBytes(bytes), 'configured transaction is not an ARKIVE v3 bundle')
})
