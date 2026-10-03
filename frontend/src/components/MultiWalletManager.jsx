import { useState, useMemo } from 'react'
import { useAccount, useConnections, useSwitchAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Copy, Check, Plus, ArrowRightLeft, Shield, Link2, Unlink, Trash2, Wallet, AlertCircle } from 'lucide-react'
import { useWalletLinker } from '../hooks/useWalletLinker'
import { isDemoMode } from '../config/demo'
import { isValidEthAddress, normalizeEthAddress } from '../lib/security'
import {
  MAX_TOTAL_WALLETS,
  MAX_SECONDARY_WALLETS,
  getConfiguredWallets,
  addConfiguredWallet,
  removeConfiguredWallet,
} from '../lib/multiWalletAccess'
import toast from 'react-hot-toast'

function formatShortAddress(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function MultiWalletManager({ currentAddress }) {
  const { connector: activeConnector } = useAccount()
  const connections = useConnections()
  const { switchAccountAsync, isPending: isSwitching } = useSwitchAccount()
  const { openConnectModal } = useConnectModal()

  const walletLinker = useWalletLinker()
  const {
    linkedWallets,
    primaryWallet,
    canAddMore,
    pendingRequest,
    isPrimary,
    isSecondary,
    requestLink,
    confirmLink,
    unlinkWallet,
    loading: linkerLoading,
    contractsDeployed,
  } = walletLinker

  const [copiedAddress, setCopiedAddress] = useState(null)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [demoSecondaries, setDemoSecondaries] = useState([])
  const [actionInProgress, setActionInProgress] = useState(false)

  // Primary address resolution
  const resolvedPrimary = useMemo(() => {
    if (isDemoMode) return currentAddress
    if (primaryWallet && isValidEthAddress(primaryWallet)) {
      return normalizeEthAddress(primaryWallet)
    }
    return currentAddress ? normalizeEthAddress(currentAddress) : null
  }, [currentAddress, primaryWallet])

  // Configured wallets from local storage
  const configuredSecondaries = useMemo(() => {
    if (!resolvedPrimary) return []
    return getConfiguredWallets(resolvedPrimary)
  }, [resolvedPrimary, actionInProgress])

  // Connected wallets from wagmi connections
  const connectedAddresses = useMemo(() => {
    const list = []
    for (const conn of connections) {
      if (Array.isArray(conn.accounts)) {
        for (const acc of conn.accounts) {
          if (isValidEthAddress(acc)) {
            const norm = normalizeEthAddress(acc)
            if (!list.some((item) => item.address === norm)) {
              list.push({ address: norm, connector: conn.connector })
            }
          }
        }
      }
    }
    return list
  }, [connections])

  // Merge secondaries into at most 2 items
  const secondaryWallets = useMemo(() => {
    if (isDemoMode) {
      return demoSecondaries.slice(0, MAX_SECONDARY_WALLETS)
    }
    if (!resolvedPrimary) return []

    const merged = new Map()

    // 1. Add onchain linked wallets
    if (Array.isArray(linkedWallets)) {
      for (const w of linkedWallets) {
        if (!isValidEthAddress(w)) continue
        const norm = normalizeEthAddress(w)
        if (norm !== resolvedPrimary) {
          merged.set(norm, {
            address: norm,
            isLinkedOnchain: true,
            isConfigured: true,
          })
        }
      }
    }

    // 2. Add configured wallets
    for (const w of configuredSecondaries) {
      const norm = normalizeEthAddress(w)
      if (norm !== resolvedPrimary && !merged.has(norm)) {
        merged.set(norm, {
          address: norm,
          isLinkedOnchain: false,
          isConfigured: true,
        })
      }
    }

    // 3. Add connected browser wallets (if not primary)
    for (const item of connectedAddresses) {
      if (item.address !== resolvedPrimary && !merged.has(item.address)) {
        merged.set(item.address, {
          address: item.address,
          isLinkedOnchain: false,
          isConfigured: false,
          connector: item.connector,
        })
      }
    }

    // Attach connector to any existing entry that matches
    for (const [addr, entry] of merged.entries()) {
      const conn = connectedAddresses.find((c) => c.address === addr)
      if (conn) {
        entry.connector = conn.connector
        entry.isConnected = true
      }
    }

    return Array.from(merged.values()).slice(0, MAX_SECONDARY_WALLETS)
  }, [isDemoMode, demoSecondaries, resolvedPrimary, linkedWallets, configuredSecondaries, connectedAddresses])

  const totalWalletsCount = 1 + secondaryWallets.length
  const canAddWallet = totalWalletsCount < MAX_TOTAL_WALLETS

  function handleCopy(addr) {
    if (!addr) return
    navigator.clipboard.writeText(addr)
    setCopiedAddress(addr)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  async function handleSwitch(connector) {
    if (!connector) {
      toast.error('Switch to this account in your wallet app')
      return
    }
    setActionInProgress(true)
    try {
      await switchAccountAsync({ connector })
      toast.success('Switched active wallet')
    } catch {
      toast.error('Unable to switch account. Select it in your wallet app.')
    } finally {
      setActionInProgress(false)
    }
  }

  async function handleManualAdd() {
    const raw = manualAddress.trim()
    if (!isValidEthAddress(raw)) {
      toast.error('Enter a valid Ethereum address (0x…)')
      return
    }
    const norm = normalizeEthAddress(raw)
    if (norm === resolvedPrimary) {
      toast.error('This is already your primary wallet')
      return
    }
    if (secondaryWallets.some((w) => w.address === norm)) {
      toast.error('Wallet already added')
      return
    }

    if (isDemoMode) {
      setDemoSecondaries((prev) => [...prev, { address: norm, isConfigured: true }])
      setManualAddress('')
      setShowManualAdd(false)
      toast.success('Demo wallet added')
      return
    }

    try {
      addConfiguredWallet(resolvedPrimary, norm)
      setActionInProgress((v) => !v)
      setManualAddress('')
      setShowManualAdd(false)
      toast.success('Wallet added to access list (total: ' + (totalWalletsCount + 1) + ' of 3)')
    } catch (err) {
      toast.error(err.message || 'Failed to add wallet')
    }
  }

  async function handleRemoveSecondary(secAddress) {
    if (isDemoMode) {
      setDemoSecondaries((prev) => prev.filter((w) => w.address !== secAddress))
      toast.success('Wallet removed')
      return
    }

    setActionInProgress(true)
    try {
      // If linked onchain, unlink via contract
      const isLinked = linkedWallets?.some(
        (w) => normalizeEthAddress(w) === normalizeEthAddress(secAddress)
      )
      if (isLinked && contractsDeployed) {
        toast('Unlinking wallet on Base Sepolia…', { icon: '⛓️' })
        await unlinkWallet(secAddress)
      }
      removeConfiguredWallet(resolvedPrimary, secAddress)
      toast.success('Wallet removed from access list')
    } catch (err) {
      toast.error(err?.message || 'Failed to remove wallet')
    } finally {
      setActionInProgress(false)
    }
  }

  async function handleLinkOnchain(secAddress) {
    if (isDemoMode) {
      toast.success('Linked in demo mode')
      return
    }
    if (!contractsDeployed) {
      toast.error('WalletLinker contract not available')
      return
    }
    setActionInProgress(true)
    try {
      const activeNorm = normalizeEthAddress(currentAddress)
      const secNorm = normalizeEthAddress(secAddress)

      if (activeNorm === secNorm) {
        // Active is secondary, request link to primary
        toast('Submitting link request to primary wallet…', { icon: '⛓️' })
        await requestLink(resolvedPrimary)
        toast.success('Link requested! Now switch to your primary wallet to confirm.')
      } else if (activeNorm === resolvedPrimary) {
        // Active is primary, confirm link
        toast('Confirming link for secondary wallet onchain…', { icon: '⛓️' })
        await confirmLink(secNorm)
        toast.success('Wallet successfully linked onchain!')
      } else {
        toast.error('Switch to this wallet or your primary wallet to link')
      }
    } catch (err) {
      toast.error(err?.message || 'Link operation failed. Ensure Base Sepolia is selected.')
    } finally {
      setActionInProgress(false)
    }
  }

  return (
    <div className="panel settings-wallet p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-faint text-xs uppercase tracking-wider">Wallets & Data Access</p>
          <p className="text-muted text-xs mt-0.5">
            Total 3 wallets can access your encrypted files, vaults, and identity.
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium ${
            totalWalletsCount === MAX_TOTAL_WALLETS
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-accent/15 text-accent border border-accent/30'
          }`}
        >
          {totalWalletsCount} / {MAX_TOTAL_WALLETS} wallets
        </span>
      </div>

      {/* Pending link request banner */}
      {pendingRequest && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertCircle size={15} className="shrink-0 text-amber-400" />
            <span>Pending link request: {formatShortAddress(pendingRequest)}</span>
          </div>
          <button
            type="button"
            disabled={actionInProgress || linkerLoading}
            onClick={() => handleLinkOnchain(pendingRequest)}
            className="btn-primary btn-primary-sm py-1 px-2.5 text-xs"
          >
            Confirm link
          </button>
        </div>
      )}

      {/* 3 Wallet Slots */}
      <div className="space-y-2.5">
        {/* Slot 1: Primary Wallet */}
        <div className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" title="Connected" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-ink font-medium">
                  {formatShortAddress(resolvedPrimary)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 font-medium">
                  Primary
                </span>
                {normalizeEthAddress(currentAddress) === resolvedPrimary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-faint">Wallet 1 · Master identity & vault key</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(resolvedPrimary)}
            disabled={!resolvedPrimary}
            className="p-1.5 rounded-lg text-faint hover:text-ink transition-colors disabled:opacity-40"
            title="Copy address"
          >
            {copiedAddress === resolvedPrimary ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>

        {/* Slot 2: Secondary Wallet 1 */}
        {secondaryWallets[0] ? (
          <div className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  secondaryWallets[0].isConnected ? 'bg-emerald-400' : 'bg-faint'
                }`}
                title={secondaryWallets[0].isConnected ? 'Connected in browser' : 'Offline / Authorized'}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-sm text-ink">
                    {formatShortAddress(secondaryWallets[0].address)}
                  </span>
                  {secondaryWallets[0].isLinkedOnchain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                      Linked onchain
                    </span>
                  )}
                  {normalizeEthAddress(currentAddress) === secondaryWallets[0].address && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-faint">Wallet 2 · Authorized data access</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {secondaryWallets[0].connector &&
                normalizeEthAddress(currentAddress) !== secondaryWallets[0].address && (
                  <button
                    type="button"
                    onClick={() => handleSwitch(secondaryWallets[0].connector)}
                    disabled={isSwitching || actionInProgress}
                    className="p-1.5 rounded-lg text-faint hover:text-ink transition-colors text-xs flex items-center gap-1"
                    title="Switch to this wallet"
                  >
                    <ArrowRightLeft size={14} />
                    <span className="text-[11px] hidden sm:inline">Switch</span>
                  </button>
                )}
              {!secondaryWallets[0].isLinkedOnchain && contractsDeployed && !isDemoMode && (
                <button
                  type="button"
                  onClick={() => handleLinkOnchain(secondaryWallets[0].address)}
                  disabled={linkerLoading || actionInProgress}
                  className="p-1.5 rounded-lg text-accent hover:text-ink transition-colors text-xs flex items-center gap-1"
                  title="Link on Base Sepolia"
                >
                  <Link2 size={14} />
                  <span className="text-[11px]">Link</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(secondaryWallets[0].address)}
                className="p-1.5 rounded-lg text-faint hover:text-ink transition-colors"
                title="Copy address"
              >
                {copiedAddress === secondaryWallets[0].address ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveSecondary(secondaryWallets[0].address)}
                disabled={actionInProgress}
                className="p-1.5 rounded-lg text-faint hover:text-red-400 transition-colors"
                title="Remove wallet"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-dashed border-line text-faint flex items-center justify-between text-xs">
            <span>Wallet 2 · Available slot</span>
            <span className="text-[11px] text-muted">Ready to connect</span>
          </div>
        )}

        {/* Slot 3: Secondary Wallet 2 */}
        {secondaryWallets[1] ? (
          <div className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  secondaryWallets[1].isConnected ? 'bg-emerald-400' : 'bg-faint'
                }`}
                title={secondaryWallets[1].isConnected ? 'Connected in browser' : 'Offline / Authorized'}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-sm text-ink">
                    {formatShortAddress(secondaryWallets[1].address)}
                  </span>
                  {secondaryWallets[1].isLinkedOnchain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                      Linked onchain
                    </span>
                  )}
                  {normalizeEthAddress(currentAddress) === secondaryWallets[1].address && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-faint">Wallet 3 · Authorized data access</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {secondaryWallets[1].connector &&
                normalizeEthAddress(currentAddress) !== secondaryWallets[1].address && (
                  <button
                    type="button"
                    onClick={() => handleSwitch(secondaryWallets[1].connector)}
                    disabled={isSwitching || actionInProgress}
                    className="p-1.5 rounded-lg text-faint hover:text-ink transition-colors text-xs flex items-center gap-1"
                    title="Switch to this wallet"
                  >
                    <ArrowRightLeft size={14} />
                    <span className="text-[11px] hidden sm:inline">Switch</span>
                  </button>
                )}
              {!secondaryWallets[1].isLinkedOnchain && contractsDeployed && !isDemoMode && (
                <button
                  type="button"
                  onClick={() => handleLinkOnchain(secondaryWallets[1].address)}
                  disabled={linkerLoading || actionInProgress}
                  className="p-1.5 rounded-lg text-accent hover:text-ink transition-colors text-xs flex items-center gap-1"
                  title="Link on Base Sepolia"
                >
                  <Link2 size={14} />
                  <span className="text-[11px]">Link</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(secondaryWallets[1].address)}
                className="p-1.5 rounded-lg text-faint hover:text-ink transition-colors"
                title="Copy address"
              >
                {copiedAddress === secondaryWallets[1].address ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveSecondary(secondaryWallets[1].address)}
                disabled={actionInProgress}
                className="p-1.5 rounded-lg text-faint hover:text-red-400 transition-colors"
                title="Remove wallet"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-dashed border-line text-faint flex items-center justify-between text-xs">
            <span>Wallet 3 · Available slot</span>
            <span className="text-[11px] text-muted">Ready to connect</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {canAddWallet ? (
        <div className="space-y-3 pt-1">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (isDemoMode) {
                  const demoAddr = `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 34)}`
                  setDemoSecondaries((prev) => [...prev, { address: demoAddr, isConfigured: true, isConnected: true }])
                  toast.success('Connected another demo wallet!')
                } else if (openConnectModal) {
                  openConnectModal()
                } else {
                  setShowManualAdd((v) => !v)
                }
              }}
              className="btn-secondary btn-primary-sm flex items-center gap-1.5 text-xs flex-1 justify-center"
            >
              <Wallet size={14} />
              Connect another wallet
            </button>
            <button
              type="button"
              onClick={() => setShowManualAdd((v) => !v)}
              className="btn-ghost btn-compact text-xs flex items-center gap-1"
            >
              <Plus size={14} />
              {showManualAdd ? 'Cancel' : 'Enter address'}
            </button>
          </div>

          {showManualAdd && (
            <div className="p-3 rounded-lg bg-surface-2 border border-line space-y-2">
              <label className="text-xs text-muted block">Add wallet address to access list</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x… (Ethereum address)"
                  className="input-field text-xs font-mono flex-1"
                />
                <button
                  type="button"
                  onClick={handleManualAdd}
                  disabled={!manualAddress.trim()}
                  className="btn-primary btn-primary-sm text-xs disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-emerald-400/90 flex items-center gap-1.5 pt-1">
          <Check size={14} className="shrink-0" />
          Maximum 3 wallets configured. All 3 wallets can access your data.
        </p>
      )}
    </div>
  )
}
