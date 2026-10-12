import { getDefaultConfig, connectorsForWallets } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets'
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
  multiInjectedProviderDiscovery: true,
  transports: { [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || undefined) },
}

export const wagmiConfig = hasWalletConnectCloudId
  ? getDefaultConfig({
      appName: 'ARKIVE',
      projectId: walletConnectProjectId,
      ...sharedOptions,
    })
  : createConfig({
      ...sharedOptions,
      // RainbowKit needs its connector metadata to render the fallback choice.
      // The injected wallet does not use WalletConnect or require a cloud ID.
      connectors: connectorsForWallets(
        [{ groupName: 'Browser wallet', wallets: [injectedWallet] }],
        { appName: 'ARKIVE' },
      ),

    })
