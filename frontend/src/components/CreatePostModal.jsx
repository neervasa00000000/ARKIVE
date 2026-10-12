import { useState, useRef, useEffect } from 'react'
import { Image, Type, Upload, X, ArrowUpRight } from 'lucide-react'
import { isDemoMode, DEMO_ADDRESS } from '../config/demo'
import { validatePostText, validatePostImageDeep } from '../lib/security'
import { usePosts } from '../hooks/usePosts'
import { vaultErrorMessage } from '../lib/setupStatus'
import { optimizeImageFile } from '../lib/imageOptimize'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalTabs } from './Modal'
import Dropzone, { DropzoneIcon } from './Dropzone'
import toast from 'react-hot-toast'

export default function CreatePostModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [preparingImage, setPreparingImage] = useState(false)
  const [retryPaid, setRetryPaid] = useState(false)
  const fileRef = useRef()
  const sending = useRef(false)
  const imageRequest = useRef(0)
  const { createPost, resumePost, retryPostUploadAfterPayment, pendingPost, loading, uploadStep, SignPromptModal } = usePosts()
  const busy = submitting || loading || preparingImage
  const pending = !isDemoMode && pendingPost
  const canSend = pending || (tab === 'text' ? Boolean(text.trim()) : Boolean(image))

  useEffect(() => {
    if (!image) { setPreview(null); return }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])
  useEffect(() => () => { imageRequest.current++ }, [])

  async function selectImage(file) {
    if (!file || busy || pending) return
    const request = ++imageRequest.current
    setPreparingImage(true)
    setError('')
    try {
      await validatePostImageDeep(file)
      const result = await optimizeImageFile(file)
      if (request === imageRequest.current) setImage(result.file)
    } catch (cause) {
      if (request === imageRequest.current) setError(vaultErrorMessage(cause))
    } finally {
      if (request === imageRequest.current) setPreparingImage(false)
    }
  }

  async function send() {
    if (sending.current || busy || !canSend) return
    sending.current = true
    setSubmitting(true)
    setError('')
    try {
      if (isDemoMode) {
        const imagePost = tab === 'image'
        if (imagePost) await validatePostImageDeep(image)
        const id = `demo-feed-${crypto.randomUUID()}`
        onSuccess?.({ optimisticPost: {
          id, author: DEMO_ADDRESS, arweaveId: id,
          contentType: imagePost ? 'image' : 'text',
          createdAt: BigInt(Math.floor(Date.now() / 1000)), likes: 0n, exists: true,
          _demoImageUrl: imagePost ? URL.createObjectURL(image) : undefined,
          _optimisticText: imagePost ? undefined : validatePostText(text),
        } })
        toast.success('Demo post added')
        return
      }
      const payload = { text: text.trim(), image: tab === 'image' ? image : null }
      const result = pending ? await resumePost() : retryPaid ? await retryPostUploadAfterPayment(payload) : await createPost(payload)
      toast.success('Post published')
      onSuccess?.(result)
    } catch (cause) {
      if (/TURBO_(UPLOAD_AFTER_PAYMENT|FUND_PENDING|CREDITS_TIMEOUT|TOPUP_TIMEOUT|UPLOAD_TIMEOUT)/.test(cause?.message || '')) setRetryPaid(true)
      setError(vaultErrorMessage(cause))
    } finally {
      sending.current = false
      setSubmitting(false)
    }
  }

  return <>
    {SignPromptModal}
    <Modal onClose={busy ? undefined : onClose}>
      <ModalHeader title={pending ? 'Finish your post' : 'New post'}
        description={isDemoMode ? 'Demo · no upload or payment.' : 'Public · uploaded copies may remain accessible.'}
        onClose={busy ? undefined : onClose} />
      {!pending && <ModalTabs tabs={[{ id: 'text', label: 'Text', icon: Type }, { id: 'image', label: 'Image', icon: Image }]}
        active={tab} onChange={(value) => { if (!busy) { setTab(value); setError('') } }} />}
      <ModalBody>
        {pending ? <div className="pending-post">
          {pending.text && <p className="post-text">{pending.text}</p>}
          <p className="text-sm text-muted">{pending.txHash ? 'Transaction submitted. Check confirmation to finish.' : 'Upload complete. Approve the post in your wallet to finish.'}</p>
          {pending.txHash && <a href={`https://sepolia.basescan.org/tx/${pending.txHash}`} target="_blank" rel="noopener noreferrer" className="text-link inline-flex items-center gap-1 mt-3">View transaction <ArrowUpRight size={14} /></a>}
        </div> : tab === 'text' ? <div>
          <label htmlFor="post-text" className="sr-only">Post text</label>
          <textarea id="post-text" value={text} onChange={(event) => setText(event.target.value)}
            disabled={busy} placeholder="Write a post…" maxLength={2000} rows={5}
            aria-describedby={error ? 'post-error' : undefined}
            className="input-field resize-none min-h-[140px]" />
          <p className="composer-count">{text.length} / 2,000</p>
        </div> : <div>
          {preview ? <div className="relative overflow-hidden rounded">
            <img src={preview} alt="Selected image" className="w-full max-h-64 object-contain" />
            <button type="button" disabled={busy} onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = '' }}
              aria-label="Remove image" className="absolute top-2 right-2 p-2 bg-surface border border-line rounded"><X size={16} /></button>
          </div> : <Dropzone filled={false} onClick={() => { if (!busy) fileRef.current?.click() }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); selectImage(event.dataTransfer.files?.[0]) }}>
            <DropzoneIcon><Upload size={20} /></DropzoneIcon>
            <p className="text-sm">Choose an image</p><p className="text-xs text-muted">PNG, JPG, WebP or GIF · 10 MB max</p>
          </Dropzone>}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
            onChange={(event) => selectImage(event.target.files?.[0])} />
        </div>}
        {error && <p id="post-error" role="alert" className="composer-error">{pending?.txHash ? 'Confirmation is taking longer. Check again without resending.' : error}</p>}
        {busy && <p role="status" className="composer-status"><span className="composer-spinner" />{preparingImage ? 'Preparing image…' : uploadStep || 'Preparing post…'}</p>}
        {!busy && retryPaid && !pending && <p className="text-xs text-muted mt-3">Retry uses existing storage credits.</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">{pending ? 'Close' : 'Cancel'}</button>
        <button type="button" onClick={send} disabled={busy || !canSend} className="btn-primary">
          {busy ? 'Sending…' : pending?.txHash ? 'Check confirmation' : pending ? 'Finish posting' : retryPaid ? 'Retry upload' : isDemoMode ? 'Add demo post' : 'Publish'}
        </button>
      </ModalFooter>
    </Modal>
  </>
}
