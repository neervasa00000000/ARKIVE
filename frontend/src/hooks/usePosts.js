import { useState } from 'react'
import { useAccount, useWriteContract, useChainId, useWalletClient } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { baseSepolia } from 'viem/chains'
import { wagmiConfig } from '../config/wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PostRegistryABI from '../contracts/PostRegistry.json'
import { useArweave } from './useArweave'
import { validatePostText, validatePostImageDeep, validateArweaveTxId } from '../lib/security'

const CREATE_POST_RECEIPT_TIMEOUT_MS = 8_000

function logTiming(phase, startedAt) {
  console.info('[ARKIVE timing]', phase, Math.round(performance.now() - startedAt))
}

export function usePosts() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const { uploadToArweave, retryFeedUpload, uploading, step, setStep, SignPromptModal } = useArweave()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)

  async function createPost({ text, image, preparedFunding }) {
    setLoading(true)
    const flowStart = performance.now()
    let arweaveId
    let contentType
    let optimisticText
    try {
      if (!address || !walletClient) throw new Error('WALLET_NOT_CONNECTED')
      if (chainId !== 84532) throw new Error('WRONG_NETWORK')

      const uploadStart = performance.now()

      if (image) {
        await validatePostImageDeep(image)
        const imageType = image.type === 'image/jpeg' || image.type === 'image/png'
          ? image.type
          : image.type?.startsWith('image/')
            ? image.type
            : 'image/png'
        setStep('Uploading…')
        arweaveId = await uploadToArweave(image, imageType, { preparedFunding })
        contentType = 'image'
      } else {
        const trimmed = validatePostText(text)
        optimisticText = trimmed
        const content = JSON.stringify({ text: trimmed, timestamp: Date.now() })
        setStep('Uploading…')
        arweaveId = await uploadToArweave(content, 'application/json', { preparedFunding })
        contentType = 'text'
      }

      logTiming('upload', uploadStart)
      arweaveId = validateArweaveTxId(arweaveId)

      setStep('Step 2 of 2 — approve on-chain post in MetaMask')
      const createStart = performance.now()
      console.info('[ARKIVE] createPost submitting', {
        arweaveId,
        contentType,
        account: address,
        contract: CONTRACT_ADDRESSES.PostRegistry,
        chainId: baseSepolia.id,
      })
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.PostRegistry,
        abi: PostRegistryABI.abi,
        functionName: 'createPost',
        args: [arweaveId, contentType],
        account: address,
        chain: baseSepolia,
      })
      console.info('[ARKIVE] createPost tx hash', hash)
      logTiming('createPost', createStart)

      const optimisticPost = {
        id: `pending-${hash}`,
        author: address,
        arweaveId,
        contentType,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        likes: 0n,
        exists: true,
        _pending: true,
        _txHash: hash,
        ...(optimisticText ? { _optimisticText: optimisticText } : {}),
      }

      setStep('')
      logTiming('createPostSubmitted', flowStart)

      void waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: baseSepolia.id,
        timeout: CREATE_POST_RECEIPT_TIMEOUT_MS,
      })
        .then(() => logTiming('createPostReceipt', createStart))
        .catch(() => {})

      return { success: true, arweaveId, txHash: hash, optimisticPost }
    } catch (error) {
      const msg = error?.shortMessage || error?.message || String(error)
      if (msg.includes('user rejected') || msg.includes('User rejected')) {
        const uploaded = typeof arweaveId === 'string' && arweaveId.length > 20
        if (uploaded) {
          throw new Error(
            `CHAIN_REGISTER_FAILED:${arweaveId}:${contentType || 'text'}:Post is on Arweave but on-chain registration was cancelled. Click Register on blockchain — you should not pay for storage again.`,
          )
        }
      }
      const uploaded = typeof arweaveId === 'string' && arweaveId.length > 20
      if (uploaded && !msg.includes('CHAIN_REGISTER_FAILED')) {
        throw new Error(
          `CHAIN_REGISTER_FAILED:${arweaveId}:${contentType || 'text'}:Post is on Arweave but on-chain registration failed. Click Register on blockchain — you should not pay for storage again.`,
        )
      }
      console.error('[ARKIVE] createPost failed', {
        message: msg,
        arweaveId,
        contentType,
        account: address,
        error,
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function registerPostOnChain(arweaveId, contentType, optimisticText) {
    setLoading(true)
    const createStart = performance.now()
    try {
      if (!address || !walletClient) throw new Error('WALLET_NOT_CONNECTED')
      if (chainId !== 84532) throw new Error('WRONG_NETWORK')
      const safeId = validateArweaveTxId(arweaveId)
      setStep('Step 2 of 2 — approve on-chain post in MetaMask')
      console.info('[ARKIVE] registerPostOnChain submitting', {
        arweaveId: safeId,
        contentType,
        account: address,
        contract: CONTRACT_ADDRESSES.PostRegistry,
      })
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.PostRegistry,
        abi: PostRegistryABI.abi,
        functionName: 'createPost',
        args: [safeId, contentType],
        account: address,
        chain: baseSepolia,
      })
      console.info('[ARKIVE] createPost tx hash', hash)
      logTiming('createPost', createStart)

      const optimisticPost = {
        id: `pending-${hash}`,
        author: address,
        arweaveId: safeId,
        contentType,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        likes: 0n,
        exists: true,
        _pending: true,
        _txHash: hash,
        ...(optimisticText ? { _optimisticText: optimisticText } : {}),
      }

      setStep('')
      void waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: baseSepolia.id,
        timeout: CREATE_POST_RECEIPT_TIMEOUT_MS,
      })
        .then(() => logTiming('createPostReceipt', createStart))
        .catch(() => {})

      return { success: true, arweaveId: safeId, txHash: hash, optimisticPost }
    } finally {
      setLoading(false)
    }
  }

  async function likePost(postId) {
    if (!address) throw new Error('WALLET_NOT_CONNECTED')
    if (chainId !== 84532) throw new Error('WRONG_NETWORK')
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.PostRegistry,
      abi: PostRegistryABI.abi,
      functionName: 'likePost',
      args: [BigInt(postId)],
      account: address,
      chain: baseSepolia,
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
  }

  async function retryPostUploadAfterPayment({ text, image }) {
    setLoading(true)
    let arweaveId
    let contentType
    let optimisticText
    try {
      if (!address || !walletClient) throw new Error('WALLET_NOT_CONNECTED')
      if (chainId !== 84532) throw new Error('WRONG_NETWORK')

      if (image) {
        await validatePostImageDeep(image)
        const imageType = image.type === 'image/jpeg' || image.type === 'image/png'
          ? image.type
          : image.type?.startsWith('image/')
            ? image.type
            : 'image/png'
        setStep('Payment sent — finishing upload…')
        arweaveId = await retryFeedUpload(image, imageType)
        contentType = 'image'
      } else {
        const trimmed = validatePostText(text)
        optimisticText = trimmed
        const content = JSON.stringify({ text: trimmed, timestamp: Date.now() })
        setStep('Payment sent — finishing upload…')
        arweaveId = await retryFeedUpload(content, 'application/json')
        contentType = 'text'
      }

      arweaveId = validateArweaveTxId(arweaveId)
      setStep('Step 2 of 2 — approve on-chain post in MetaMask')
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.PostRegistry,
        abi: PostRegistryABI.abi,
        functionName: 'createPost',
        args: [arweaveId, contentType],
        account: address,
        chain: baseSepolia,
      })

      const optimisticPost = {
        id: `pending-${hash}`,
        author: address,
        arweaveId,
        contentType,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        likes: 0n,
        exists: true,
        _pending: true,
        _txHash: hash,
        ...(optimisticText ? { _optimisticText: optimisticText } : {}),
      }

      setStep('')
      return { success: true, arweaveId, txHash: hash, optimisticPost }
    } catch (error) {
      const msg = error?.shortMessage || error?.message || String(error)
      const uploaded = typeof arweaveId === 'string' && arweaveId.length > 20
      if (uploaded) {
        throw new Error(
          `CHAIN_REGISTER_FAILED:${arweaveId}:${contentType || 'text'}:Post is on Arweave but on-chain registration failed. Click Register on blockchain — you should not pay for storage again.`,
        )
      }
      console.error('[ARKIVE] retryPostUploadAfterPayment failed', { message: msg, error })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return { createPost, retryPostUploadAfterPayment, registerPostOnChain, likePost, loading: loading || uploading, uploadStep: step, SignPromptModal }
}
