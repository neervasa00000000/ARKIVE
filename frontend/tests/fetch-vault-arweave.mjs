/**
 * Smoke test: probe Arweave gateways for a vault tx ID from VaultRegistry.
 * Run: node --test tests/fetch-vault-arweave.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http } from 'viem'
import { probeArweaveBytes } from '../src/lib/arweaveCache.js'
import { isVaultBundleBytes } from '../src/lib/vaultBundle.js'
import { validateArweaveTxId } from '../src/lib/security.js'
import VaultRegistryABI from '../src/contracts/VaultRegistry.json' with { type: 'json' }

const VAULT_REGISTRY = '0xA8f35315E5a00C18b89758cc5A45d38cA20FB000'
const KNOWN_OWNER = '0xD49426272cb4d3a4E14e5110Fa30c3e017e86e4d'
/** pinkpace.png — uploaded via turbo dev before production-upload fix */
const LEGACY_DEV_TX = 'nmQBEEH96k2iAYjnsgHrLsMiL5Q4Zdlu2z-by79gSx0'

describe('vault arweave fetch', () => {
  it('validates tx id format', () => {
    assert.equal(validateArweaveTxId(LEGACY_DEV_TX), LEGACY_DEV_TX)
  })

  it('reads on-chain arweave id for pinkpace.png', async () => {
    const client = createPublicClient({
      chain: { id: 84532 },
      transport: http('https://sepolia.base.org'),
    })
    const files = await client.readContract({
      address: VAULT_REGISTRY,
      abi: VaultRegistryABI.abi,
      functionName: 'getMyFiles',
      account: KNOWN_OWNER,
    })
    const pink = files.find((f) => f.fileName === 'pinkpace.png')
    assert.ok(pink, 'pinkpace.png should exist on VaultRegistry')
    assert.equal(pink.encryptedArweaveId, LEGACY_DEV_TX)
  })

  it('probes gateways for legacy dev upload (may be absent — documents orphan tx)', async () => {
    const bytes = await probeArweaveBytes(LEGACY_DEV_TX)
    if (bytes) {
      assert.ok(isVaultBundleBytes(bytes), 'vault bundle should start with ARKV magic')
    } else {
      console.warn(
        '[fetch-vault-arweave] Legacy dev upload not on gateways — re-seal file after production-upload fix',
      )
    }
  })
})
