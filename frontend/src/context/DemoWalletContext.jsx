import { createContext, useContext, useState, useCallback } from 'react'
import { isDemoMode, DEMO_ADDRESS } from '../config/demo'

const DemoWalletContext = createContext(null)

const BACKUP_WARNING_KEY = 'arkive_demo_backup_acknowledged'

export function DemoWalletProvider({ children }) {
  const [connected, setConnected] = useState(false)

  const connect = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 600))
    setConnected(true)
  }, [])

  const disconnect = useCallback(() => {
    setConnected(false)
  }, [])

  const value = {
    isDemoMode,
    isConnected: connected,
    address: connected ? DEMO_ADDRESS : undefined,
    connect,
    disconnect,
    hasAcknowledgedBackup: () => localStorage.getItem(BACKUP_WARNING_KEY) === 'true',
    acknowledgeBackup: () => localStorage.setItem(BACKUP_WARNING_KEY, 'true'),
  }

  return (
    <DemoWalletContext.Provider value={value}>
      {children}
    </DemoWalletContext.Provider>
  )
}

export function useDemoWallet() {
  const ctx = useContext(DemoWalletContext)
  if (!ctx) throw new Error('useDemoWallet must be used within DemoWalletProvider')
  return ctx
}
