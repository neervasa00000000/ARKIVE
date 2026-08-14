import { useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { isDemoMode } from '../config/demo'
import { useDemoWallet } from '../context/DemoWalletContext'

/** Unified wallet state — demo simulation or real wagmi. */
export function useWalletState() {
  const wagmi = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const demo = useDemoWallet()

  const disconnectWallet = useCallback(() => {
    wagmiDisconnect()
  }, [wagmiDisconnect])

  if (isDemoMode) {
    return {
      isConnected: demo.isConnected,
      address: demo.address,
      isDemoMode: true,
      connect: demo.connect,
      disconnect: demo.disconnect,
    }
  }

  return {
    isConnected: wagmi.isConnected,
    address: wagmi.address,
    isDemoMode: false,
    connect: null,
    disconnect: disconnectWallet,
  }
}
