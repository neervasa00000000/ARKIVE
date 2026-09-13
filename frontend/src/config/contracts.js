import { DEPLOYED_ADDRESSES } from './deployedContracts.js'

export const CONTRACT_ADDRESSES = { ...DEPLOYED_ADDRESSES }
const overrides = {
  PointsSystem: import.meta.env?.VITE_POINTS_SYSTEM,
  WalletLinker: import.meta.env?.VITE_WALLET_LINKER,
  UserRegistry: import.meta.env?.VITE_USER_REGISTRY,
  PostRegistry: import.meta.env?.VITE_POST_REGISTRY,
  VaultRegistry: import.meta.env?.VITE_VAULT_REGISTRY,
}
for (const [name, address] of Object.entries(overrides)) {
  if (!address || address === '0x...') continue
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`Invalid ${name} contract address`)
  CONTRACT_ADDRESSES[name] = address
}
