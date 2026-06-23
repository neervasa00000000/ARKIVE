import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { baseSepolia } from 'wagmi/chains'

const PLACEHOLDER_IDS = new Set([
  '',
  'get_from_walletconnect_cloud',
  'your_project_id_here',
])

export const walletConnectProjectId = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''
).trim()

export const hasWalletConnectCloudId =
  !!walletConnectProjectId &&
  !PLACEHOLDER_IDS.has(walletConnectProjectId) &&
  /^[a-f0-9-]{32,36}$/i.test(walletConnectProjectId)

const sharedOptions = {
  chains: [baseSepolia],
  ssr: false,
}

export const wagmiConfig = hasWalletConnectCloudId
  ? getDefaultConfig({
      appName: 'ARKIVE',
      projectId: walletConnectProjectId,
      ...sharedOptions,
    })
  : createConfig({
      ...sharedOptions,
      connectors: [injected()],
      transports: {
        [baseSepolia.id]: http(),
      },
    })
