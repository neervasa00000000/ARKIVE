import { CONTRACT_ADDRESSES } from './contracts'

const ZERO = '0x0000000000000000000000000000000000000000'
const contractsDeployed = CONTRACT_ADDRESSES.PostRegistry !== ZERO
const demoEnv = import.meta.env.VITE_DEMO_MODE

/** Demo mode — off when VITE_DEMO_MODE=false or live contracts are configured. */
export const isDemoMode =
  demoEnv === 'true' || (demoEnv !== 'false' && !contractsDeployed)

export const DEMO_ADDRESS = '0x7a3f8b2e1c4d9a6f5e8b3c2d1a4f6e8c2d'
export const DEMO_ADDRESS_SHORT = '0x7a3f...8c2d'
