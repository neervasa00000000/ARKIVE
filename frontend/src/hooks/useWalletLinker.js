import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { wagmiConfig } from '../config/wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import WalletLinkerABI from '../contracts/WalletLinker.json'
import { isValidEthAddress } from '../lib/security'

const ZERO = '0x0000000000000000000000000000000000000000'

export function useWalletLinker() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)

  const linkerAddress = CONTRACT_ADDRESSES.WalletLinker
  const enabled = !!address && linkerAddress && linkerAddress !== ZERO

  const { data: primaryWallet, refetch: refetchPrimary } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'getPrimary',
    args: [address],
    enabled,
  })

  const listPrimary =
    primaryWallet && primaryWallet !== ZERO ? primaryWallet : address

  const { data: linkedWallets, refetch: refetchLinked } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'getLinkedWallets',
    args: [listPrimary],
    enabled: enabled && !!listPrimary,
  })

  const { data: canAddMore } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'canAddMoreWallets',
    args: [address],
    enabled,
  })

  const { data: identitySize } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'getIdentitySize',
    args: [address],
    enabled,
  })

  const { data: pendingRequest, refetch: refetchPending } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'hasPendingRequest',
    args: [address],
    enabled,
  })

  async function requestLink(primaryAddress) {
    if (!isValidEthAddress(primaryAddress)) throw new Error('INVALID_ADDRESS')
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'requestLink',
        args: [primaryAddress],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      refetchPending()
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  async function confirmLink(secondaryAddress) {
    if (!isValidEthAddress(secondaryAddress)) throw new Error('INVALID_ADDRESS')
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'confirmLink',
        args: [secondaryAddress],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      refetchLinked()
      refetchPrimary()
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  async function cancelLinkRequest() {
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'cancelLinkRequest',
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      refetchPending()
    } finally {
      setLoading(false)
    }
  }

  async function unlinkWallet(walletAddress) {
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'unlinkWallet',
        args: [walletAddress],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      refetchLinked()
      refetchPrimary()
    } finally {
      setLoading(false)
    }
  }

  const resolvedPrimary = primaryWallet || address
  const isSecondary =
    resolvedPrimary && address && resolvedPrimary.toLowerCase() !== address.toLowerCase()
  const isPrimary = !isSecondary

  const pending =
    pendingRequest && pendingRequest !== ZERO ? pendingRequest : null

  return {
    linkedWallets: linkedWallets || [],
    primaryWallet: resolvedPrimary,
    canAddMore: canAddMore ?? true,
    identitySize: identitySize ? Number(identitySize) : 1,
    pendingRequest: pending,
    isSecondary,
    isPrimary,
    requestLink,
    confirmLink,
    cancelLinkRequest,
    unlinkWallet,
    loading,
    refetch: refetchLinked,
    contractsDeployed: enabled,
  }
}
