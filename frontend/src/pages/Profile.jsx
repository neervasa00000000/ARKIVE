import { useAccount, useReadContract, useWriteContract, useChainId } from 'wagmi'
import { useState, useEffect } from 'react'
import { waitForTransactionReceipt } from '@wagmi/core'
import { wagmiConfig } from '../config/wagmi'
import { baseSepolia } from 'viem/chains'
import { Copy, Check } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import { isDemoMode } from '../config/demo'
import { useWalletState } from '../hooks/useWalletState'
import UserRegistryABI from '../contracts/UserRegistry.json'
import PointsSystemABI from '../contracts/PointsSystem.json'
import { usePoints } from '../hooks/usePoints'
import RecoveryGuide from '../components/RecoveryGuide'
import PageHeader from '../components/PageHeader'
import { WalletLinkerPanel } from '../components/WalletLinkerPanel'
import toast from 'react-hot-toast'

const DEMO_PROFILE = {
  username: 'explorer',
  balance: 225,
  dailyEarned: 50,
  totalEarned: 225,
}

export default function Profile() {
  const wallet = useWalletState()
  const { address: wagmiAddress } = useAccount()
  const chainId = useChainId()
  const address = isDemoMode ? wallet.address : wagmiAddress

  const { balance, dailyEarned, dailyRemaining } = usePoints()
  const [username, setUsername] = useState('')
  const [registering, setRegistering] = useState(false)
  const [copied, setCopied] = useState(false)
  const { writeContractAsync } = useWriteContract()

  const { data: user, refetch: refetchUser } = useReadContract({
    address: CONTRACT_ADDRESSES.UserRegistry,
    abi: UserRegistryABI.abi,
    functionName: 'getUser',
    args: [address],
    enabled: !!address && !isDemoMode,
  })

  const { data: totalEarned } = useReadContract({
    address: CONTRACT_ADDRESSES.PointsSystem,
    abi: PointsSystemABI.abi,
    functionName: 'totalEarned',
    args: [address],
    enabled: !!address && !isDemoMode,
  })

  useEffect(() => {
    if (window.location.hash === '#recovery') {
      const el = document.getElementById('recovery')
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    }
  }, [])

  async function handleRegister() {
    if (!username.trim()) return
    if (!address) return
    if (!isDemoMode && chainId !== 84532) {
      toast.error('Switch MetaMask to Base Sepolia')
      return
    }
    setRegistering(true)
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.UserRegistry,
        abi: UserRegistryABI.abi,
        functionName: 'register',
        args: [username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')],
        account: address,
        chain: baseSepolia,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: baseSepolia.id })

      try {
        const bonusHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.PointsSystem,
          abi: PointsSystemABI.abi,
          functionName: 'claimWelcomeBonus',
          account: address,
          chain: baseSepolia,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: bonusHash })
        toast.success('Welcome to ARKIVE! 225 points awarded.')
      } catch {}

      refetchUser()
    } catch {
      toast.error('Registration failed. Username may be taken.')
    } finally {
      setRegistering(false)
    }
  }

  function copyAddress() {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isRegistered = isDemoMode ? true : user?.exists
  const displayUsername = isDemoMode ? DEMO_PROFILE.username : user?.username
  const displayBalance = isDemoMode ? DEMO_PROFILE.balance : balance
  const displayDailyEarned = isDemoMode ? DEMO_PROFILE.dailyEarned : dailyEarned
  const displayTotalEarned = isDemoMode
    ? DEMO_PROFILE.totalEarned
    : totalEarned
      ? Number(totalEarned)
      : 0
  const displayDailyRemaining = isDemoMode
    ? Math.max(0, 500 - DEMO_PROFILE.dailyEarned)
    : dailyRemaining

  return (
    <div className="space-y-10">
      <PageHeader
        title="Profile"
        description={isDemoMode ? 'Demo wallet — explore without contracts' : 'Your on-chain identity'}
      />

      <div className="space-y-3">
        <div className="panel p-5">
          <p className="text-faint text-xs mb-2 uppercase tracking-wider">Wallet</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-ink">
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              disabled={!address}
              className="p-2 rounded-lg text-faint hover:text-ink transition-colors disabled:opacity-40"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

          {!isRegistered ? (
            <div className="panel p-6">
              <p className="font-display text-sm font-semibold text-ink mb-4">Choose your username</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="satoshi"
                  maxLength={32}
                  className="input-field flex-1"
                />
                <button
                  onClick={handleRegister}
                  disabled={registering || !username.trim()}
                  className="btn-primary btn-primary-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registering ? 'Registering...' : 'Register'}
                </button>
              </div>
              <p className="text-faint text-xs mt-3">
                Stored on Base. Lowercase letters, numbers, underscores only. 225 welcome points.
              </p>
            </div>
          ) : (
            <div className="panel p-6">
              <p className="text-faint text-xs mb-1 uppercase tracking-wider">Username</p>
              <p className="font-display text-xl font-semibold text-ink">@{displayUsername}</p>
              {isDemoMode && (
                <p className="text-faint text-xs mt-2">Demo placeholder — not registered on-chain</p>
              )}
            </div>
          )}

          <div className="panel p-6">
            <p className="font-display text-sm font-semibold text-ink mb-4">Points</p>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted text-sm">Balance</span>
                <span className="font-mono text-ink font-medium">{displayBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-sm">Earned today</span>
                <span className="font-mono text-ink text-sm">{displayDailyEarned} / 500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-sm">All-time earned</span>
                <span className="font-mono text-ink text-sm">
                  {displayTotalEarned.toLocaleString()}
                </span>
              </div>

              <div className="mt-2">
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink rounded-full transition-all"
                    style={{ width: `${Math.min(100, (displayDailyEarned / 500) * 100)}%` }}
                  />
                </div>
                <p className="font-mono text-faint text-xs mt-1.5">
                  {displayDailyRemaining} points remaining today
                </p>
              </div>
            </div>
          </div>

          {!isDemoMode && <WalletLinkerPanel />}
      </div>

      <section id="recovery" className="scroll-mt-8 pt-8 border-t border-line">
        <h2 className="page-title text-xl mb-2">Recovery</h2>
        <p className="page-desc mb-6">
          Access your data if ARKIVE disappears. Bookmark the Arweave URLs below.
        </p>
        <RecoveryGuide embedded />
      </section>
    </div>
  )
}
