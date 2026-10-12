import { useEffect, useRef, useState } from 'react'
import { useAccount, useWriteContract, useChainId, useWalletClient, usePublicClient } from 'wagmi'
import { getAccount, waitForTransactionReceipt } from '@wagmi/core'
import { baseSepolia } from 'viem/chains'
import { wagmiConfig } from '../config/wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PostRegistryABI from '../contracts/PostRegistry.json'
import { useArweave } from './useArweave'
import { validatePostText, validatePostImageDeep, validateArweaveTxId } from '../lib/security'
import { assertWalletSession } from '../lib/walletSession'
import { requireSuccessfulReceipt } from '../lib/transactionReceipt'
import { publishPost, readPendingPost, writePendingPost } from '../lib/postPublishing'
import { setCachedContent } from '../lib/arweaveCache'

export function usePosts() {
  const { address, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const chainId = useChainId()
  const { uploadToArweave, retryFeedUpload, uploading, step, setStep, SignPromptModal } = useArweave()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)
  const sessionKey = address ? `${baseSepolia.id}:${address.toLowerCase()}` : ''
  const [pendingPost, setPendingPost] = useState(() => readPendingPost(sessionKey))
  const pendingRef = useRef(pendingPost)
  const busy = useRef(false)

  useEffect(() => {
    const restored = readPendingPost(sessionKey)
    pendingRef.current = restored
    setPendingPost(restored)
  }, [sessionKey])

  function assertSession() {
    if (!address || !walletClient) throw new Error('WALLET_NOT_CONNECTED')
    if (chainId !== baseSepolia.id) throw new Error('WRONG_NETWORK')
    if (CONTRACT_ADDRESSES.PostRegistry === '0x0000000000000000000000000000000000000000') throw new Error('CONTRACTS_NOT_DEPLOYED')
    assertWalletSession(address, connector?.uid, walletClient, getAccount(wagmiConfig))
  }

  async function sendPost({ text, image, preparedFunding } = {}, checkpoint, retryPaid = false) {
    if (busy.current) throw new Error('POST_ALREADY_SENDING')
    busy.current = true
    setLoading(true)
    const contentType = checkpoint?.contentType || (image ? 'image' : 'text')
    const updateCheckpoint = (value) => {
      pendingRef.current = value
      setPendingPost(value)
      writePendingPost(sessionKey, value)
    }
    try {
      const safeText = checkpoint?.text ?? (contentType === 'text' ? validatePostText(text) : undefined)
      assertSession()
      if (!checkpoint?.arweaveId) {
        if (image) await validatePostImageDeep(image)
        // Check contract permissions and daily limits before paying for storage.
        setStep('Checking post…')
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.PostRegistry, abi: PostRegistryABI.abi,
          functionName: 'createPost', args: ['A'.repeat(43), contentType], account: address,
        })
      }
      const result = await publishPost({
        checkpoint: { ...checkpoint, contentType, text: safeText },
        assertSession, onStep: setStep, onCheckpoint: updateCheckpoint,
        upload: async () => {
          const body = image || JSON.stringify({ text: safeText, timestamp: Date.now() })
          const mime = image?.type || 'application/json'
          const id = validateArweaveTxId(await (retryPaid ? retryFeedUpload : uploadToArweave)(body, mime, { preparedFunding }))
          if (safeText) void setCachedContent(id, JSON.stringify({ text: safeText }), 'application/json').catch(() => {})
          return id
        },
        submit: ({ arweaveId }) => writeContractAsync({
          address: CONTRACT_ADDRESSES.PostRegistry, abi: PostRegistryABI.abi,
          functionName: 'createPost', args: [validateArweaveTxId(arweaveId), contentType],
          account: address, connector, chain: baseSepolia,
        }),
        confirm: (hash) => requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash, timeout: 60_000 }),
      })
      return { success: true, arweaveId: result.arweaveId, txHash: result.txHash, optimisticPost: {
        id: `pending-${result.txHash}`, author: address, arweaveId: result.arweaveId,
        contentType, createdAt: BigInt(Math.floor(Date.now() / 1000)), likes: 0n,
        exists: true, _pending: true, _txHash: result.txHash,
        ...(safeText ? { _optimisticText: safeText } : {}),
      } }
    } finally {
      busy.current = false
      setLoading(false)
      setStep('')
    }
  }

  async function createPost(payload) {
    if (pendingRef.current) throw new Error('POST_NEEDS_RESUME')
    return sendPost(payload)
  }
  async function resumePost() {
    const checkpoint = pendingRef.current
    if (!checkpoint) throw new Error('POST_NOT_PENDING')
    return sendPost({}, checkpoint)
  }
  async function registerPostOnChain(arweaveId, contentType, text) {
    return sendPost({}, { arweaveId: validateArweaveTxId(arweaveId), contentType, text })
  }
  async function likePost(postId) {
    assertSession()
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.PostRegistry, abi: PostRegistryABI.abi,
      functionName: 'likePost', args: [BigInt(postId)], account: address,
      connector, chain: baseSepolia,
    })
    await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash, timeout: 60_000 })
  }
  return { createPost, resumePost, registerPostOnChain, pendingPost,
    retryPostUploadAfterPayment: (payload) => sendPost(payload, pendingRef.current, true),
    likePost, loading: loading || uploading, uploadStep: step, SignPromptModal }
}
