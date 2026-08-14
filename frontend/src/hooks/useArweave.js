import { useState } from 'react'
import { useWalletClient } from 'wagmi'
import { validateArweaveTxId } from '../lib/security'
import { fetchArweaveContent } from '../lib/arweaveCache'
import { uploadFeedBytes, retryFeedUploadAfterPayment, estimateBundleByteCount } from '../lib/turboUpload'
import { useTurboSignPrompt } from './useTurboSignPrompt'

export function useArweave() {
  const { data: walletClient } = useWalletClient()
  const { onSignPrompt, SignPromptModal } = useTurboSignPrompt()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState('')

  async function uploadToArweave(data, contentType = 'application/json', uploadOpts = {}) {
    if (!walletClient) {
      throw new Error('WALLET_NOT_CONNECTED')
    }

    setUploading(true)
    setProgress(0)
    setStep('Uploading…')

    try {
      let fileData
      let byteCount = uploadOpts.byteCount
      if (data instanceof File || data instanceof Blob) {
        fileData = new Uint8Array(await data.arrayBuffer())
        byteCount = byteCount ?? estimateBundleByteCount(fileData.length)
      } else if (typeof data === 'string') {
        fileData = data
        byteCount = byteCount ?? estimateBundleByteCount(new TextEncoder().encode(data).length)
      } else {
        fileData = data
        const rawLen = fileData?.length ?? fileData?.byteLength ?? 0
        byteCount = byteCount ?? estimateBundleByteCount(rawLen)
      }

      const id = await uploadFeedBytes(walletClient, fileData, {
        contentType,
        fast: true,
        byteCount,
        onProgress: setProgress,
        onStep: setStep,
        onSignPrompt,
        preparedFunding: uploadOpts.preparedFunding,
      })

      console.info('[ARKIVE Turbo] feed upload complete', {
        id,
        bytes: fileData?.length ?? fileData?.byteLength,
        contentType,
      })

      setProgress(100)
      setStep('')
      return id
    } catch (error) {
      console.error('Arweave upload failed:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  async function fetchFromArweave(txId) {
    const safeId = validateArweaveTxId(txId)
    const { body, contentType } = await fetchArweaveContent(safeId)
    return new Response(body, { headers: { 'Content-Type': contentType } })
  }

  async function retryFeedUpload(data, contentType = 'application/json', uploadOpts = {}) {
    if (!walletClient) {
      throw new Error('WALLET_NOT_CONNECTED')
    }

    setUploading(true)
    setProgress(0)
    setStep('Payment sent — finishing upload…')

    try {
      let fileData
      let byteCount = uploadOpts.byteCount
      if (data instanceof File || data instanceof Blob) {
        fileData = new Uint8Array(await data.arrayBuffer())
        byteCount = byteCount ?? estimateBundleByteCount(fileData.length)
      } else if (typeof data === 'string') {
        fileData = data
        byteCount = byteCount ?? estimateBundleByteCount(new TextEncoder().encode(data).length)
      } else {
        fileData = data
        const rawLen = fileData?.length ?? fileData?.byteLength ?? 0
        byteCount = byteCount ?? estimateBundleByteCount(rawLen)
      }

      const id = await retryFeedUploadAfterPayment(walletClient, {
        data: fileData,
        contentType,
        byteCount,
      }, {
        onProgress: setProgress,
        onStep: setStep,
        onSignPrompt,
      })

      setProgress(100)
      setStep('')
      return id
    } catch (error) {
      console.error('Arweave retry upload failed:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  return { uploadToArweave, retryFeedUpload, fetchFromArweave, uploading, progress, step, setStep, SignPromptModal }
}
