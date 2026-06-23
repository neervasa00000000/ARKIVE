import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { wagmiConfig } from '../config/wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PostRegistryABI from '../contracts/PostRegistry.json'
import { useArweave } from './useArweave'

export function usePosts() {
  const { address } = useAccount()
  const { uploadToArweave } = useArweave()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)

  async function createPost({ text, image }) {
    setLoading(true)
    try {
      let arweaveId
      let contentType

      if (image) {
        arweaveId = await uploadToArweave(image, image.type)
        contentType = 'image'
      } else {
        const content = JSON.stringify({ text, timestamp: Date.now() })
        arweaveId = await uploadToArweave(content, 'application/json')
        contentType = 'text'
      }

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.PostRegistry,
        abi: PostRegistryABI.abi,
        functionName: 'createPost',
        args: [arweaveId, contentType],
      })

      await waitForTransactionReceipt(wagmiConfig, { hash })
      return { success: true, arweaveId }
    } catch (error) {
      console.error('Create post failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function likePost(postId) {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.PostRegistry,
      abi: PostRegistryABI.abi,
      functionName: 'likePost',
      args: [BigInt(postId)],
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
  }

  return { createPost, likePost, loading }
}
