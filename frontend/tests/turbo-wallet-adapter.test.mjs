/**
 * Simulates browser wallet adapter signing against arbundles InjectedEthereumSigner.
 * Run: node --test tests/turbo-wallet-adapter.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Wallet } from 'ethers'
import { InjectedEthereumSigner } from '@dha-team/arbundles'
import { hashMessage as ethersHashMessage } from 'ethers'
import { arrayify } from '@ethersproject/bytes'
import { recoverPublicKey } from '@ethersproject/signing-key'

const TURBO_WALLET_LINK_MESSAGE =
  'Authorize ARKIVE to upload files to permanent storage using your Base Sepolia wallet. This is not a transaction — it links your wallet for small storage payments.'

function createMockWalletAdapter(wallet) {
  return {
    getSigner: () => ({
      signMessage: (message) => wallet.signMessage(message),
      sendTransaction: async () => ({ hash: `0x${'ab'.repeat(32)}` }),
    }),
  }
}

test('InjectedEthereumSigner signs deep hash like ethers Wallet', async () => {
  const wallet = Wallet.createRandom()
  const adapter = createMockWalletAdapter(wallet)
  const signer = new InjectedEthereumSigner(adapter)
  await signer.setPublicKey()

  const deepHash = new Uint8Array(32)
  deepHash.fill(0xcd)
  const sig = await signer.sign(deepHash)
  assert.equal(sig.length, 65)

  const direct = await wallet.signMessage(deepHash)
  assert.equal(Buffer.from(sig).toString('hex'), direct.slice(2))
})

test('custom wallet link message recovers public key', async () => {
  const wallet = Wallet.createRandom()
  const adapter = createMockWalletAdapter(wallet)
  const signer = new InjectedEthereumSigner(adapter)

  signer.setPublicKey = async () => {
    const signedMsg = await adapter.getSigner().signMessage(TURBO_WALLET_LINK_MESSAGE)
    const hash = ethersHashMessage(TURBO_WALLET_LINK_MESSAGE)
    const recoveredKey = recoverPublicKey(arrayify(hash), signedMsg)
    signer.publicKey = Buffer.from(arrayify(recoveredKey))
  }

  await signer.setPublicKey()
  assert.ok(signer.publicKey?.length > 0)
  const direct = await wallet.signMessage(TURBO_WALLET_LINK_MESSAGE)
  const hash = ethersHashMessage(TURBO_WALLET_LINK_MESSAGE)
  const recovered = recoverPublicKey(arrayify(hash), direct)
  assert.equal(Buffer.from(signer.publicKey).toString('hex'), Buffer.from(arrayify(recovered)).toString('hex'))
})

test('wallet adapter sendTransaction returns { hash }', async () => {
  const wallet = Wallet.createRandom()
  const adapter = createMockWalletAdapter(wallet)
  const result = await adapter.getSigner().sendTransaction({
    to: wallet.address,
    value: 0n,
  })
  assert.ok(result.hash)
  assert.match(result.hash, /^0x[0-9a-fA-F]{64}$/)
})
