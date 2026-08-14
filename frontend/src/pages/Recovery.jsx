import { Navigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { isDemoMode } from '../config/demo'
import { useWalletState } from '../hooks/useWalletState'
import RecoveryGuide from '../components/RecoveryGuide'
import Logo from '../components/Logo'

export default function Recovery() {
  const wallet = useWalletState()
  const wagmi = useAccount()
  const isConnected = isDemoMode ? wallet.isConnected : wagmi.isConnected

  if (isConnected) {
    return <Navigate to="/profile#recovery" replace />
  }

  return (
    <div className="app-bg min-h-screen">
      <header className="px-6 sm:px-10 py-6 max-w-2xl mx-auto">
        <Logo />
      </header>
      <RecoveryGuide />
    </div>
  )
}
