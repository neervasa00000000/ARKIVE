import { keccak256, toBytes } from 'viem'
import { baseSepolia } from 'viem/chains'
import { CONTRACT_ADDRESSES } from '../config/contracts'

/** @deprecated Legacy — decrypt only for payloads sealed before EIP-712 v2 */
export const DERIVATION_MESSAGE_V1 =
  'ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT'

export const DERIVATION_VERSION_EIP712 = 'eip712-v2'

const VAULT_KEY_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  VaultKeyDerivation: [
    { name: 'purpose', type: 'string' },
    { name: 'wallet', type: 'address' },
  ],
}

export function buildEip712Domain() {
  return {
    name: 'ARKIVE',
    version: '2',
    chainId: 84532,
    verifyingContract: CONTRACT_ADDRESSES.VaultRegistry,
  }
}

export function buildEip712Message(walletAddress) {
  return {
    purpose: 'VAULT_KEY_DERIVATION',
    wallet: walletAddress,
  }
}

async function importDerivedAesKey(signature) {
  const derivedKeyBytes = toBytes(keccak256(toBytes(signature)))
  return crypto.subtle.importKey(
    'raw',
    derivedKeyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** New seals — EIP-712 typed data bound to chain + VaultRegistry contract */
export async function deriveKeyFromWalletV2(walletClient, walletAddress, domainOverride = null) {
  const domain = domainOverride || buildEip712Domain()
  const message = buildEip712Message(walletAddress)

  const signature = await walletClient.signTypedData({
    account: walletAddress,
    domain,
    types: VAULT_KEY_TYPES,
    primaryType: 'VaultKeyDerivation',
    message,
    chain: baseSepolia,
  })

  return importDerivedAesKey(signature)
}

/** Legacy payloads only */
export async function deriveKeyFromWalletV1(walletClient, walletAddress) {
  const signature = await walletClient.signMessage({
    account: walletAddress,
    message: DERIVATION_MESSAGE_V1,
  })
  return importDerivedAesKey(signature)
}

export function getPayloadDerivationVersion(payload) {
  if (payload?.derivationVersion === DERIVATION_VERSION_EIP712) {
    return DERIVATION_VERSION_EIP712
  }
  if (payload?.derivationMessage === DERIVATION_MESSAGE_V1) {
    return 'v1'
  }
  return 'v1'
}

function resolveEip712DomainFromPayload(payload) {
  const stored = payload?.eip712Domain
  if (
    stored &&
    stored.chainId === 84532 &&
    typeof stored.verifyingContract === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(stored.verifyingContract)
  ) {
    return {
      name: stored.name || 'ARKIVE',
      version: stored.version || '2',
      chainId: stored.chainId,
      verifyingContract: stored.verifyingContract,
    }
  }
  return buildEip712Domain()
}

/** Decrypt path picks v1 vs v2 from stored payload metadata */
export async function deriveKeyForPayload(walletClient, walletAddress, payload) {
  const version = getPayloadDerivationVersion(payload)
  if (version === DERIVATION_VERSION_EIP712) {
    return deriveKeyFromWalletV2(
      walletClient,
      walletAddress,
      resolveEip712DomainFromPayload(payload),
    )
  }
  return deriveKeyFromWalletV1(walletClient, walletAddress)
}
