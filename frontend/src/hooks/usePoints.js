import { useAccount, useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PointsSystemABI from '../contracts/PointsSystem.json'

export function usePoints() {
  const { address } = useAccount()

  const { data: balance, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PointsSystem,
    abi: PointsSystemABI.abi,
    functionName: 'getPoints',
    args: [address],
    enabled: !!address,
  })

  const { data: dailyEarned } = useReadContract({
    address: CONTRACT_ADDRESSES.PointsSystem,
    abi: PointsSystemABI.abi,
    functionName: 'getDailyEarned',
    args: [address],
    enabled: !!address,
  })

  return {
    balance: balance ? Number(balance) : 0,
    dailyEarned: dailyEarned ? Number(dailyEarned) : 0,
    dailyRemaining: Math.max(0, 500 - (dailyEarned ? Number(dailyEarned) : 0)),
    refetch,
  }
}
