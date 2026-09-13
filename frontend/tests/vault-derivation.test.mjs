import { test } from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { deriveKeyForPayload, deriveKeyFromWalletV2, buildEip712Domain } from '../src/lib/vaultDerivation.js'
import { aesEncrypt, aesDecrypt } from '../src/lib/vaultKeyWrap.js'
const account = privateKeyToAccount('0x' + '1'.repeat(64))
const wallet = { signTypedData: ({ account: ignored, chain, ...args }) => account.signTypedData(args) }
test('wallet key remains recoverable with the stored old deployment domain', async () => {
  const domain = { ...buildEip712Domain(), verifyingContract: '0x'+'2'.repeat(40) }
  const key = await deriveKeyFromWalletV2(wallet, account.address, domain)
  const { encrypted, iv } = await aesEncrypt(key, new Uint8Array([1,2,3]))
  const recovered = await deriveKeyForPayload(wallet, account.address, { derivationVersion: 'eip712-v2', eip712Domain: domain })
  assert.deepEqual(new Uint8Array(await aesDecrypt(recovered, encrypted, iv)), new Uint8Array([1,2,3]))
})
test('malicious or missing stored domains fail before asking for a signature', async () => {
  let signatures = 0
  const blockedWallet = { signTypedData: () => { signatures++; throw new Error('must not sign') } }
  for (const domain of [undefined, { ...buildEip712Domain(), name: 'Evil app' }, { ...buildEip712Domain(), chainId: 1 }]) {
    await assert.rejects(deriveKeyForPayload(blockedWallet, account.address, { derivationVersion: 'eip712-v2', eip712Domain: domain }), /INVALID_DERIVATION_DOMAIN/)
  }
  assert.equal(signatures, 0)
})
test('unknown derivation versions cannot silently fall back to legacy signing', async () => {
  await assert.rejects(deriveKeyForPayload({}, account.address, { derivationVersion: 'future-unsupported' }), /UNSUPPORTED_KEY_DERIVATION/)
})
