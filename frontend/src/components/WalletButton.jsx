import { ConnectButton } from '@rainbow-me/rainbowkit'
import { isDemoMode, DEMO_ADDRESS_SHORT } from '../config/demo'
import { useDemoVault } from '../context/DemoVaultContext'
import { useWalletState } from '../hooks/useWalletState'

function formatShortAddress(address) {
  if (!address) return DEMO_ADDRESS_SHORT
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function WalletButton({ label, accountStatus, showBalance }) {
  const { isConnected, address, connect, disconnect } = useWalletState()
  const { resetVault } = useDemoVault()
  const sidebar = accountStatus === 'avatar'

  function handleDisconnect() {
    disconnect?.()
    if (isDemoMode) resetVault()
  }

  if (isConnected) {
    const short = formatShortAddress(address)

    if (sidebar) {
      return (
        <button
          type="button"
          onClick={handleDisconnect}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-2 border border-line hover:border-line-strong transition-colors text-left"
          title="Disconnect wallet"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-mono text-xs text-muted truncate">{short}</span>
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={handleDisconnect}
        className="btn-secondary font-mono text-xs"
      >
        {short} · Disconnect
      </button>
    )
  }

  if (isDemoMode && connect) {
    return (
      <button type="button" onClick={() => connect()} className="btn-primary">
        {label || 'Connect wallet'}
      </button>
    )
  }

  return (
    <ConnectButton
      label={label}
      accountStatus={accountStatus}
      showBalance={showBalance}
    />
  )
}
