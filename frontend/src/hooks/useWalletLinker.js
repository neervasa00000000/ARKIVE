import { requireSuccessfulReceipt } from '../lib/transactionReceipt'
import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { wagmiConfig } from '../config/wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import WalletLinkerABI from '../contracts/WalletLinker.json'
import { isValidEthAddress } from '../lib/security'

const ZERO = '0x0000000000000000000000000000000000000000'

export function useWalletLinker() {
  const { address, connector, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)

  const linkerAddress = CONTRACT_ADDRESSES.WalletLinker
  const enabled = !!address && linkerAddress && linkerAddress !== ZERO

  const { data: primaryWallet, refetch: refetchPrimary } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'getPrimary',
    args: [address],
    chainId: 84532,
    query: { enabled: Boolean(enabled) },
  })

  const listPrimary =
    primaryWallet && primaryWallet !== ZERO ? primaryWallet : address

  const { data: linkedWallets, refetch: refetchLinked } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'getLinkedWallets',
    args: [listPrimary],
    chainId: 84532,
    query: { enabled: Boolean(enabled && listPrimary) },
  })

  const { data: canAddMore, refetch: refetchCapacity } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'canAddMoreWallets',
    args: [address],
    chainId: 84532,
    query: { enabled: Boolean(enabled) },
  })

  const { data: identitySize, refetch: refetchSize } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'getIdentitySize',
    args: [address],
    chainId: 84532,
    query: { enabled: Boolean(enabled) },
  })

  const { data: pendingRequest, refetch: refetchPending } = useReadContract({
    address: linkerAddress,
    abi: WalletLinkerABI.abi,
    functionName: 'hasPendingRequest',
    args: [address],
    chainId: 84532,
    query: { enabled: Boolean(enabled) },
  })

  async function refreshIdentity() {
    await Promise.all([refetchPrimary(), refetchLinked(), refetchPending(), refetchCapacity(), refetchSize()])
  }

  async function requestLink(primaryAddress) {
    if (!isValidEthAddress(primaryAddress)) throw new Error('INVALID_ADDRESS')
    if (!address || !connector) throw new Error('WALLET_NOT_CONNECTED')
    if (chainId !== 84532) throw new Error('Switch to Base Sepolia before linking wallets.')
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        account: address,
        connector,
        chainId: 84532,
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'requestLink',
        args: [primaryAddress],
      })
      await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash })
      await refreshIdentity()
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  async function confirmLink(secondaryAddress) {
    if (!isValidEthAddress(secondaryAddress)) throw new Error('INVALID_ADDRESS')
    if (!address || !connector) throw new Error('WALLET_NOT_CONNECTED')
    if (chainId !== 84532) throw new Error('Switch to Base Sepolia before linking wallets.')
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        account: address,
        connector,
        chainId: 84532,
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'confirmLink',
        args: [secondaryAddress],
      })
      await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash })
      await refreshIdentity()
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  async function cancelLinkRequest() {
    if (!address || !connector) throw new Error('WALLET_NOT_CONNECTED')
    if (chainId !== 84532) throw new Error('Switch to Base Sepolia before linking wallets.')
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        account: address,
        connector,
        chainId: 84532,
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'cancelLinkRequest',
      })
      await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash })
      await refreshIdentity()
    } finally {
      setLoading(false)
    }
  }

  async function unlinkWallet(walletAddress) {
    if (!address || !connector) throw new Error('WALLET_NOT_CONNECTED')
    if (chainId !== 84532) throw new Error('Switch to Base Sepolia before linking wallets.')
    setLoading(true)
    try {
      const hash = await writeContractAsync({
        account: address,
        connector,
        chainId: 84532,
        address: linkerAddress,
        abi: WalletLinkerABI.abi,
        functionName: 'unlinkWallet',
        args: [walletAddress],
      })
      await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash })
      await refreshIdentity()
    } finally {
      setLoading(false)
    }
  }

  const resolvedPrimary = primaryWallet || address
  const isSecondary =
    resolvedPrimary && address && resolvedPrimary.toLowerCase() !== address.toLowerCase()
  const isPrimary = !!primaryWallet && !isSecondary

  const pending =
    pendingRequest && pendingRequest !== ZERO ? pendingRequest : null

  return {
    linkedWallets: linkedWallets || [],
    primaryWallet: resolvedPrimary,
    canAddMore: canAddMore ?? false,
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
