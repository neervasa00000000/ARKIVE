import { useState, useRef, useEffect } from 'react'
import { Image, Type, Upload, Link2 } from 'lucide-react'
import { useWalletClient } from 'wagmi'
import { usePosts } from '../hooks/usePosts'
import { vaultErrorMessage } from '../lib/setupStatus'
import { warmTurboForWallet, prepareFeedUpload, estimateBundleByteCount } from '../lib/turboUpload'
import { optimizeImageFile } from '../lib/imageOptimize'
import { hashBytes, findKnownUpload, rememberUpload } from '../lib/contentDedup'
import { MetaMaskSignInlineNotice } from './SignExplainModal'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalTabs } from './Modal'
import Dropzone, { DropzoneIcon } from './Dropzone'
import toast from 'react-hot-toast'

function parseChainRegisterError(error) {
  const code = error?.message || String(error)
  if (!code.startsWith('CHAIN_REGISTER_FAILED:')) return null
  const parts = code.split(':')
  return {
    arweaveId: parts[1],
    contentType: parts[2] === 'text' || parts[2] === 'image' ? parts[2] : 'text',
    message: parts.slice(3).join(':') || parts.slice(2).join(':'),
  }
}

export default function CreatePostModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [prep, setPrep] = useState(null)
  const [prepStep, setPrepStep] = useState('')
  const [pendingChain, setPendingChain] = useState(null)
  const [imageHash, setImageHash] = useState(null)
  const [dedupArweaveId, setDedupArweaveId] = useState(null)
  const [imageOptimizedNote, setImageOptimizedNote] = useState(null)
  const fileRef = useRef()
  const { data: walletClient } = useWalletClient()
  const { createPost, registerPostOnChain, loading, uploadStep, SignPromptModal } = usePosts()

  const isStep2 = loading && uploadStep?.includes('Step 2')

  useEffect(() => {
    if (!walletClient) {
      setPrep(null)
      setPrepStep('')
      return
    }
    warmTurboForWallet(walletClient)
    setPrep(null)
    prepareFeedUpload(walletClient, setPrepStep)
      .then(setPrep)
      .catch(() => {})
  }, [walletClient])

  async function handleImageSelect(e) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return

    setDedupArweaveId(null)
    setImageHash(null)
    setImageOptimizedNote(null)

    const { file, optimized, savedBytes } = await optimizeImageFile(rawFile)
    setImage(file)
    setPreview(URL.createObjectURL(file))
    if (optimized) {
      setImageOptimizedNote(`Stripped metadata — ${Math.max(1, Math.round(savedBytes / 1024))} KB smaller, pixels untouched`)
    }

    const address = walletClient?.account?.address
    if (address) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const hash = await hashBytes(bytes)
        setImageHash(hash)
        const known = findKnownUpload(address, hash)
        if (known) setDedupArweaveId(known)
      } catch {
        /* dedup is a pure optimization — never block the upload flow on it */
      }
    }

    if (walletClient) {
      setPrep(null)
      prepareFeedUpload(walletClient, setPrepStep, file.size)
        .then(setPrep)
        .catch(() => {})
    }
  }

  async function handleRegisterOnChain() {
    if (!pendingChain) return
    try {
      const result = await registerPostOnChain(
        pendingChain.arweaveId,
        pendingChain.contentType,
        tab === 'text' ? text.trim() : undefined,
      )
      toast.success('Posted permanently to Arweave')
      setPendingChain(null)
      onSuccess?.(result)
    } catch (error) {
      toast.error(vaultErrorMessage(error))
    }
  }

  async function handleSubmit() {
    if (tab === 'text' && !text.trim()) {
      toast.error('Write something first')
      return
    }
    if (tab === 'image' && !image) {
      toast.error('Select an image')
      return
    }

    setPendingChain(null)
    try {
      if (tab === 'image' && dedupArweaveId) {
        const result = await registerPostOnChain(dedupArweaveId, 'image', undefined)
        toast.success('Already on Arweave — posted without a new upload')
        onSuccess?.(result)
        return
      }

      let preparedFunding = prep?.preparedFunding ?? null
      if (walletClient) {
        const rawBytes =
          tab === 'image' && image
            ? image.size
            : new TextEncoder().encode(
                JSON.stringify({ text: text.trim(), timestamp: Date.now() }),
              ).length
        const uploadBytes = estimateBundleByteCount(rawBytes)
        try {
          const freshPrep = await prepareFeedUpload(walletClient, setPrepStep, rawBytes)
          preparedFunding = freshPrep?.preparedFunding ?? preparedFunding
          setPrep(freshPrep)
        } catch {
          /* proceed with existing prep */
        }
        console.info('[ARKIVE] feed submit prep', { rawBytes, uploadBytes, hasPreparedFunding: Boolean(preparedFunding) })
      }

      const result = await createPost({
        text: text.trim(),
        image: tab === 'image' ? image : null,
        preparedFunding,
      })
      const address = walletClient?.account?.address
      if (tab === 'image' && imageHash && address && result?.arweaveId) {
        rememberUpload(address, imageHash, result.arweaveId)
      }
      toast.success('Posted permanently to Arweave')
      onSuccess?.(result)
    } catch (error) {
      setPrepStep('')
      const chainPending = parseChainRegisterError(error)
      if (chainPending?.arweaveId) {
        setPendingChain(chainPending)
        toast.error(vaultErrorMessage(error), { duration: 8000 })
      } else {
        toast.error(vaultErrorMessage(error), { duration: 8000 })
      }
    }
  }

  return (
    <>
      {SignPromptModal}
      <Modal onClose={onClose}>
      <ModalHeader
        title="Create post"
        description="Stored on Arweave forever. Cannot be deleted."
        onClose={onClose}
      />

      <ModalTabs
        tabs={[
          { id: 'text', label: 'Text', icon: Type },
          { id: 'image', label: 'Image', icon: Image },
        ]}
        active={tab}
        onChange={setTab}
      />

      <ModalBody>
        {tab === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What do you want to store permanently?"
            maxLength={2000}
            rows={5}
            className="input-field resize-none min-h-[128px]"
          />
        ) : (
          <div>
            {preview ? (
              <div className="relative rounded-xl overflow-hidden ring-1 ring-border">
                <img src={preview} alt="Preview" className="w-full max-h-64 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null)
                    setPreview(null)
                    setImageHash(null)
                    setDedupArweaveId(null)
                    setImageOptimizedNote(null)
                  }}
                  className="absolute top-2 right-2 modal-close bg-black/50 hover:bg-black/70 text-white"
                >
                  ×
                </button>
              </div>
            ) : (
              <Dropzone filled={false} onClick={() => fileRef.current?.click()}>
                <DropzoneIcon>
                  <Upload size={20} />
                </DropzoneIcon>
                <p className="font-body text-text-primary text-sm">Click to select an image</p>
                <p className="font-body text-text-muted text-xs">PNG, JPG, GIF · max 10 MB</p>
              </Dropzone>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>
        )}

        {tab === 'text' && prep?.skipEthPayment && (
          <p className="font-body text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            Storage credits ready — signature only
          </p>
        )}

        {tab === 'image' && dedupArweaveId && (
          <p className="font-body text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            Identical file already on Arweave — this post won't pay for storage again
          </p>
        )}

        {tab === 'image' && !dedupArweaveId && imageOptimizedNote && (
          <p className="font-body text-xs text-text-muted mt-2">{imageOptimizedNote}</p>
        )}

        {isStep2 && (
          <div className="callout mt-4 border-accent/30 bg-accent/5">
            <p className="text-sm font-medium text-text-primary">Confirm post on blockchain</p>
            <p className="text-xs text-text-muted mt-1">
              Storage is done. Approve the transaction in MetaMask to publish on the feed.
            </p>
          </div>
        )}

        {pendingChain && (
          <div className="callout callout-warn mt-4">
            <p className="text-sm font-medium text-text-primary">On Arweave — not on feed yet</p>
            <p className="text-xs text-text-muted mt-1 font-mono break-all">
              {pendingChain.arweaveId}
            </p>
            <p className="text-xs text-text-muted mt-2">
              {pendingChain.message || 'Complete the blockchain step to show this post on the feed.'}
            </p>
            <button
              type="button"
              onClick={handleRegisterOnChain}
              disabled={loading}
              className="btn-primary btn-primary-sm mt-3"
            >
              <Link2 size={15} />
              Register on blockchain
            </button>
          </div>
        )}

        <div className="mt-4">
          <MetaMaskSignInlineNotice />
          {!loading && prepStep && (
            <p className="font-body text-xs text-text-muted mt-2">{prepStep}</p>
          )}
          {loading && uploadStep && !isStep2 && (
            <p className="font-body text-xs text-text-muted mt-2">{uploadStep}</p>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary btn-primary-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? isStep2
              ? 'Confirm on blockchain…'
              : uploadStep?.toLowerCase().includes('metamask') ||
                  uploadStep?.toLowerCase().includes('approve') ||
                  uploadStep?.toLowerCase().includes('signature')
                ? 'Approve in MetaMask…'
                : 'Uploading…'
            : 'Post permanently'}
        </button>
      </ModalFooter>
    </Modal>
    </>
  )
}
