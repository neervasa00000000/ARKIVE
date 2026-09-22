import { useState, useEffect } from 'react'
import { Link2, Link2Off, Plus, Clock, Shield, X, Check } from 'lucide-react'
import { useWalletLinker } from '../hooks/useWalletLinker'
import { useAccount } from 'wagmi'
import { isValidEthAddress } from '../lib/security'
import { isDemoMode, DEMO_ADDRESS } from '../config/demo'
import toast from 'react-hot-toast'

const DEMO_LINKS_KEY = 'arkive_demo_linked_wallets'

function shortAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function WalletRow({ address: addr, label, onUnlink, loading }) {
  return (
    <div className="flex items-center justify-between bg-surface-2 border border-line rounded-xl px-3 py-2.5">
      <span className="font-mono text-xs text-ink">{shortAddr(addr)}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-faint">{label}</span>
        {onUnlink && (
          <button
            type="button"
            onClick={() => onUnlink(addr)}
            disabled={loading}
            className="text-faint hover:text-red-400 transition-colors disabled:opacity-40"
            title="Unlink this wallet"
          >
            <Link2Off size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function DemoWalletLinkerPanel() {
  const [linkedWallets, setLinkedWallets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DEMO_LINKS_KEY) || '[]') }
    catch { return [] }
  })
  const [mode, setMode] = useState(false)
  const [inputAddress, setInputAddress] = useState('')

  function addBackupWallet() {
    const nextAddress = inputAddress.trim()
    if (!isValidEthAddress(nextAddress)) {
      toast.error('Enter a valid wallet address starting with 0x')
      return
    }
    if (nextAddress.toLowerCase() === DEMO_ADDRESS.toLowerCase() || linkedWallets.some((wallet) => wallet.toLowerCase() === nextAddress.toLowerCase())) {
      toast.error('This wallet is already connected')
      return
    }
    const next = [...linkedWallets, nextAddress]
    setLinkedWallets(next)
    localStorage.setItem(DEMO_LINKS_KEY, JSON.stringify(next))
    setInputAddress('')
    setMode(false)
    toast.success('Backup wallet connected in this demo')
  }

  function removeBackupWallet(walletAddress) {
    const next = linkedWallets.filter((wallet) => wallet !== walletAddress)
    setLinkedWallets(next)
    localStorage.setItem(DEMO_LINKS_KEY, JSON.stringify(next))
    toast.success('Backup wallet removed')
  }

  return (
    <div className="panel recovery-wallet-panel p-6">
      <div className="recovery-wallet-head">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={17} className="text-accent" />
            <h3 className="font-display text-sm font-semibold text-ink">Recovery wallets</h3>
          </div>
          <p className="text-muted text-xs">{1 + linkedWallets.length} of 3 authorised wallet slots used</p>
        </div>
        <span className="status-badge status-badge-success">Demo</span>
      </div>

      <div className="recovery-wallet-list">
        <WalletRow address={DEMO_ADDRESS} label="primary" />
        {linkedWallets.map((wallet) => (
          <WalletRow key={wallet} address={wallet} label="backup" onUnlink={removeBackupWallet} />
        ))}
      </div>

      {mode ? (
        <div className="recovery-connect-flow">
          <div className="recovery-step-copy"><span>1</span><p><strong>Enter the backup wallet</strong><small>In the live app, this wallet requests access and the primary wallet confirms onchain.</small></p></div>
          <label className="block">
            <span className="sr-only">Backup wallet address</span>
            <input type="text" value={inputAddress} onChange={(event) => setInputAddress(event.target.value)} placeholder="0x..." className="input-field font-mono text-xs" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={addBackupWallet} disabled={!inputAddress.trim()} className="btn-primary btn-primary-sm">Connect backup wallet</button>
            <button type="button" onClick={() => { setMode(false); setInputAddress('') }} className="btn-ghost btn-primary-sm">Cancel</button>
          </div>
        </div>
      ) : (
        linkedWallets.length < 2 && <button type="button" onClick={() => setMode(true)} className="btn-secondary btn-primary-sm mt-4"><Plus size={15} /> Add backup wallet</button>
      )}

      <p className="recovery-wallet-note">Backup wallets are authorised when a file is stored. Existing encrypted files keep the access rules they were sealed with.</p>
    </div>
  )
}

function LiveWalletLinkerPanel() {
  const { address, connector, chainId } = useAccount()
  const {
    linkedWallets,
    primaryWallet,
    canAddMore,
    identitySize,
    pendingRequest,
    isSecondary,
    isPrimary,
    requestLink,
    confirmLink,
    cancelLinkRequest,
    unlinkWallet,
    loading,
    contractsDeployed,
  } = useWalletLinker()

  const [mode, setMode] = useState(null)
  const [inputAddress, setInputAddress] = useState('')
  const [confirmingAddress, setConfirmingAddress] = useState('')

  useEffect(() => {
    setMode(null)
    setInputAddress('')
    setConfirmingAddress('')
  }, [address, connector?.uid])

  if (!contractsDeployed) {
    return (
      <div className="panel p-6">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={16} className="text-muted" />
          <p className="font-display text-sm font-semibold text-ink">Linked Wallets</p>
        </div>
        <p className="text-faint text-xs leading-relaxed">
          Deploy contracts to Base Sepolia to enable on-chain wallet linking (max 3 per identity).
        </p>
      </div>
    )
  }

  async function handleRequestLink() {
    const addr = inputAddress.trim()
    if (!isValidEthAddress(addr)) {
      toast.error('Enter a valid wallet address starting with 0x')
      return
    }
    try {
      await requestLink(addr)
      toast.success('Link request sent. Primary wallet must confirm on-chain.')
      setInputAddress('')
      setMode(null)
    } catch (error) {
      const msg = error?.message || ''
      if (msg.includes('Already linked')) toast.error('This wallet is already linked')
      else if (msg.includes('pending')) toast.error('You already have a pending request')
      else toast.error('Request failed. Check the address and try again.')
    }
  }

  async function handleConfirmLink() {
    const addr = confirmingAddress.trim()
    if (!isValidEthAddress(addr)) {
      toast.error('Enter the secondary wallet address to confirm')
      return
    }
    try {
      await confirmLink(addr)
      toast.success('Wallet linked on-chain')
      setConfirmingAddress('')
      setMode(null)
    } catch {
      toast.error('Confirm failed. Ensure that wallet sent a request to you.')
    }
  }

  async function handleUnlink(walletAddr) {
    try {
      await unlinkWallet(walletAddr)
      toast.success('Wallet unlinked')
    } catch {
      toast.error('Unlink failed')
    }
  }

  async function handleCancelRequest() {
    try {
      await cancelLinkRequest()
      toast.success('Link request cancelled')
    } catch {
      toast.error('Cancel failed')
    }
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Link2 size={16} className="text-muted" />
            <p className="font-display text-sm font-semibold text-ink">Linked Wallets</p>
          </div>
          <p className="text-faint text-xs">
            {identitySize} of 3 wallet slots used · on-chain only
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${i <= identitySize ? 'bg-ink' : 'bg-line'}`}
            />
          ))}
        </div>
      </div>

      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 border ${
          isPrimary
            ? 'bg-surface-2 border-line'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}
      >
        <Shield size={14} className={isPrimary ? 'text-muted' : 'text-amber-400'} />
        <div>
          <p className={`font-mono text-xs font-medium ${isPrimary ? 'text-ink' : 'text-amber-300'}`}>
            {isPrimary ? 'Primary wallet' : 'Secondary wallet'}
          </p>
          {!isPrimary && (
            <p className="font-mono text-xs text-amber-300/70">Primary: {shortAddr(primaryWallet)}</p>
          )}
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <p className="font-mono text-xs text-faint">Connected</p>
        <WalletRow address={address} label={isPrimary ? 'primary' : 'secondary'} />
      </div>

      {linkedWallets.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="font-mono text-xs text-faint">Linked</p>
          {linkedWallets.map((w) => (
            <WalletRow
              key={w}
              address={w}
              label="linked"
              onUnlink={isPrimary ? handleUnlink : undefined}
              loading={loading}
            />
          ))}
        </div>
      )}

      {pendingRequest && (
        <div className="callout callout-warn mb-3 py-3">
          <Clock size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-amber-200">Request pending</p>
            <p className="font-mono text-xs text-amber-200/70">
              Waiting for {shortAddr(pendingRequest)} to confirm
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelRequest}
            disabled={loading}
            className="text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-40 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {chainId !== 84532 && <p role="status" className="text-sm text-amber-200 mb-3">Switch to Base Sepolia using the wallet button to manage links.</p>}

      {mode === 'request' && (
        <div className="mb-3 p-4 bg-surface-2 border border-line rounded-xl">
          <p className="text-muted text-xs mb-2 leading-relaxed">
            Enter the primary wallet address. That wallet must sign to confirm on Base.
          </p>
          <input
            type="text"
            aria-label="Primary wallet address"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            placeholder="0x..."
            className="input-field font-mono text-xs mb-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRequestLink}
              disabled={loading || !inputAddress.trim()}
              className="flex-1 btn-primary btn-primary-sm disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
            <button
              type="button"
              onClick={() => { setMode(null); setInputAddress('') }}
              className="btn-ghost px-3"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {mode === 'confirm' && (
        <div className="mb-3 p-4 bg-surface-2 border border-line rounded-xl">
          <p className="text-muted text-xs mb-2 leading-relaxed">
            Enter the secondary wallet that sent you a link request.
          </p>
          <input
            type="text"
            aria-label="Secondary wallet address"
            value={confirmingAddress}
            onChange={(e) => setConfirmingAddress(e.target.value)}
            placeholder="0x..."
            className="input-field font-mono text-xs mb-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmLink}
              disabled={loading || !confirmingAddress.trim()}
              className="flex-1 btn-primary btn-primary-sm disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Link'}
            </button>
            <button
              type="button"
              onClick={() => { setMode(null); setConfirmingAddress('') }}
              className="btn-ghost px-3"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {mode === null && chainId === 84532 && (
        <div className="flex gap-2 mt-2">
          {canAddMore && isPrimary && linkedWallets.length === 0 && !pendingRequest && (
            <button
              type="button"
              onClick={() => setMode('request')}
              className="flex-1 flex items-center justify-center gap-1.5 btn-secondary py-2 text-xs"
            >
              <Plus size={13} />
              Request backup access
            </button>
          )}
          {isPrimary && (
            <button
              type="button"
              onClick={() => setMode('confirm')}
              className="flex-1 flex items-center justify-center gap-1.5 btn-secondary py-2 text-xs"
            >
              <Check size={13} />
              Confirm backup wallet
            </button>
          )}
          {isSecondary && (
            <button
              type="button"
              onClick={() => handleUnlink(address)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 btn-ghost py-2 text-xs hover:text-red-400 disabled:opacity-50"
            >
              <Link2Off size={13} />
              Unlink this wallet
            </button>
          )}
        </div>
      )}

      <p className="font-mono text-faint text-xs mt-4 leading-relaxed">
        Wallet linking shares your on-chain identity. Opening encrypted files still requires an authorized
        decryption wallet or recovery passphrase. Request from the secondary wallet, then switch to the
        primary wallet to confirm on Base Sepolia.
      </p>
    </div>
  )
}

export function WalletLinkerPanel() {
  return isDemoMode ? <DemoWalletLinkerPanel /> : <LiveWalletLinkerPanel />
}
