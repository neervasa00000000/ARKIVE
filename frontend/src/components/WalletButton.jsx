import { useAccount, useConnections, useSwitchAccount } from 'wagmi'
import { useState } from 'react'
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit'
import { isDemoMode, DEMO_ADDRESS_SHORT } from '../config/demo'
import { useDemoVault } from '../context/DemoVaultContext'
import { useWalletState } from '../hooks/useWalletState'

function formatShortAddress(address) {
  if (!address) return DEMO_ADDRESS_SHORT
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function RealWalletButton(props) {
  const { connector: activeConnector, isConnected } = useAccount()
  const connections = useConnections()
  const { switchAccountAsync, isPending } = useSwitchAccount()
  const { openConnectModal } = useConnectModal()
  const [error, setError] = useState('')

  async function selectWallet(connector) {
    setError('')
    try { await switchAccountAsync({ connector }) }
    catch { setError('Unable to switch wallets. Try reconnecting that wallet.') }
  }

  return (
    <div className="space-y-2 min-w-0">
      <ConnectButton {...props} />
      {isConnected && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer py-2">Switch wallet</summary>
          <div className="space-y-2 py-2">
            {connections.map(({ connector, accounts }) => (
              <button type="button" key={connector.uid}
                onClick={() => selectWallet(connector)}
                disabled={isPending || connector.uid === activeConnector?.uid}
                className="block w-full text-left p-2 rounded-lg border border-line disabled:opacity-50">
                {connector.name} · {formatShortAddress(accounts[0])}
                {connector.uid === activeConnector?.uid ? ' · Active' : ''}
              </button>
            ))}
            <button type="button" onClick={openConnectModal} disabled={!openConnectModal || isPending}
              className="btn-secondary text-xs w-full">Connect another wallet</button>
            <p>Change accounts within a wallet using its own app.</p>
          </div>
        </details>
      )}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function WalletButton({ label, accountStatus, showBalance }) {
  const { isConnected, address, connect, disconnect } = useWalletState()
  const { resetVault } = useDemoVault()
  const sidebar = accountStatus === 'avatar'

  function handleDisconnect() {
    disconnect?.()
    if (isDemoMode) resetVault()
  }

  if (!isDemoMode) return <RealWalletButton label={label} accountStatus={accountStatus} showBalance={showBalance} />

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
