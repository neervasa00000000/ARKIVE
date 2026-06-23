import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { useState } from 'react'
import { waitForTransactionReceipt } from '@wagmi/core'
import { wagmiConfig } from '../config/wagmi'
import { Copy, Check } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import UserRegistryABI from '../contracts/UserRegistry.json'
import PointsSystemABI from '../contracts/PointsSystem.json'
import { usePoints } from '../hooks/usePoints'
import toast from 'react-hot-toast'

export default function Profile() {
  const { address } = useAccount()
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
    enabled: !!address,
  })

  const { data: totalEarned } = useReadContract({
    address: CONTRACT_ADDRESSES.PointsSystem,
    abi: PointsSystemABI.abi,
    functionName: 'totalEarned',
    args: [address],
    enabled: !!address,
  })

  async function handleRegister() {
    if (!username.trim()) return
    setRegistering(true)
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.UserRegistry,
        abi: UserRegistryABI.abi,
        functionName: 'register',
        args: [username.trim()],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })

      try {
        const bonusHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.PointsSystem,
          abi: PointsSystemABI.abi,
          functionName: 'claimWelcomeBonus',
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: bonusHash })
        toast.success('Welcome to ARKIVE! 225 points awarded.')
      } catch {}

      refetchUser()
    } catch (error) {
      toast.error('Registration failed. Username may be taken.')
    } finally {
      setRegistering(false)
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isRegistered = user?.exists

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-bold text-text-primary mb-8">Profile</h1>

      <div className="bg-card border border-border rounded-xl p-6 mb-4">
        <p className="font-body text-text-secondary text-xs mb-2 uppercase tracking-wide">Wallet</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-text-primary text-sm">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button onClick={copyAddress} className="text-text-muted hover:text-text-primary transition-colors">
            {copied ? <Check size={16} className="text-cyan-400" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {!isRegistered ? (
        <div className="bg-card border border-border rounded-xl p-6 mb-4">
          <p className="font-display text-sm font-semibold text-text-primary mb-4">Choose your username</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="satoshi"
              maxLength={32}
              className="flex-1 bg-elevated border border-border rounded-lg px-4 py-2.5 font-body text-text-primary text-sm focus:outline-none focus:border-cyan-400 placeholder:text-text-muted"
            />
            <button
              onClick={handleRegister}
              disabled={registering || !username.trim()}
              className="bg-cyan-400 text-base px-5 py-2.5 rounded-lg font-display font-semibold text-sm hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {registering ? 'Registering...' : 'Register'}
            </button>
          </div>
          <p className="font-body text-text-muted text-xs mt-3">
            Registration is on-chain. Receive 225 welcome points.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6 mb-4">
          <p className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wide">Username</p>
          <p className="font-display text-xl font-semibold text-text-primary">@{user.username}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <p className="font-display text-sm font-semibold text-text-primary mb-4">Points</p>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="font-body text-text-secondary text-sm">Balance</span>
            <span className="font-mono text-cyan-400 font-medium">{balance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-body text-text-secondary text-sm">Earned today</span>
            <span className="font-mono text-text-primary text-sm">{dailyEarned} / 500</span>
          </div>
          <div className="flex justify-between">
            <span className="font-body text-text-secondary text-sm">All-time earned</span>
            <span className="font-mono text-text-primary text-sm">{totalEarned ? Number(totalEarned).toLocaleString() : 0}</span>
          </div>

          <div className="mt-2">
            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (dailyEarned / 500) * 100)}%` }}
              />
            </div>
            <p className="font-mono text-text-muted text-xs mt-1.5">{dailyRemaining} points remaining today</p>
          </div>
        </div>
      </div>
    </div>
  )
}
