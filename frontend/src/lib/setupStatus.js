import { CONTRACT_ADDRESSES } from '../config/contracts'

const ZERO = '0x0000000000000000000000000000000000000000'

function hasArweaveKey() {
  const key = import.meta.env.VITE_ARWEAVE_KEY
  if (!key || key === '{}') return false
  try {
    const jwk = JSON.parse(key)
    return !!(jwk.kty || jwk.n)
  } catch {
    return false
  }
}

export function getSetupStatus() {
  const contractsDeployed = CONTRACT_ADDRESSES.VaultRegistry !== ZERO
  const arweaveConfigured = hasArweaveKey()

  return {
    contractsDeployed,
    arweaveConfigured,
    ready: contractsDeployed && arweaveConfigured,
    missing: [
      !contractsDeployed && 'Smart contracts not deployed to Base Sepolia',
      !arweaveConfigured && 'Arweave upload key not configured in build',
    ].filter(Boolean),
  }
}

export function vaultErrorMessage(error) {
  const code = error?.message || String(error)
  const lower = code.toLowerCase()

  if (code === 'WALLET_NOT_CONNECTED') {
    return 'Connect your wallet first.'
  }
  if (code === 'WRONG_NETWORK') {
    return 'Switch MetaMask to Base Sepolia testnet (chain 84532).'
  }
  if (code === 'CONTRACTS_NOT_DEPLOYED') {
    return 'Contracts are not deployed yet. Deploy to Base Sepolia and rebuild the preview.'
  }
  if (code === 'ARWEAVE_NOT_CONFIGURED') {
    return 'Arweave key missing from build. Add VITE_ARWEAVE_KEY and rebuild.'
  }
  if (lower.includes('user rejected') || lower.includes('denied')) {
    return 'Transaction cancelled in wallet.'
  }
  if (lower.includes('lit') || lower.includes('encrypt')) {
    return 'Lit Protocol encryption failed. Check console and try a smaller file.'
  }
  if (lower.includes('arweave') || lower.includes('turbo')) {
    return 'Arweave upload failed. Check VITE_ARWEAVE_KEY and wallet credits.'
  }
  if (lower.includes('invalid address') || lower.includes('0x000')) {
    return 'Contract address missing. Deploy contracts and rebuild.'
  }

  return code.length < 120 ? code : 'Upload failed. See browser console for details.'
}
