import { useState, useRef, useEffect } from 'react'
import { Upload, Lock, Download } from 'lucide-react'
import { useAccount, useWalletClient } from 'wagmi'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage, vaultErrorDetail } from '../lib/setupStatus'
import { warmTurboWalletLink } from '../lib/turboUpload'
import { validateSealFileDeep } from '../lib/security'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'
import { MetaMaskSignInlineNotice } from './SignExplainModal'
import Dropzone, { DropzoneIcon } from './Dropzone'
import toast from 'react-hot-toast'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function friendlyStep(step) {
  if (!step) return ''
  const s = step.toLowerCase()
  if (s.includes('encrypt')) return 'Encrypting…'
  if (s.includes('uploading')) return 'Uploading…'
  if (s.includes('storage signature')) return 'Approve signature in MetaMask…'
  if (s.includes('wallet link')) return 'Approve wallet link in MetaMask…'
  if (s.includes('vault key')) return 'Approve vault key in MetaMask…'
  if (s.includes('storage payment') || s.includes(' eth ')) return 'Approve ETH payment in MetaMask…'
  if (s.includes('payment confirming')) return 'Payment confirming…'
  if (s.includes('metamask') || s.includes('approve')) return 'Check MetaMask…'
  if (s.includes('blockchain') || s.includes('register')) return 'Saving record…'
  if (s.includes('storage') || s.includes('credit')) return 'Preparing storage…'
  return 'Working…'
}

export default function UploadModal({ onClose, onSuccess }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [costEstimate, setCostEstimate] = useState(null)
  const [lastError, setLastError] = useState(null)
  const fileRef = useRef()
  const { storeFile, getStorageEstimate, loading, step, uploadProgress, SignPromptModal } = useVault()

  useEffect(() => {
    if (!file || !walletClient) {
      setCostEstimate(null)
      return
    }
    let cancelled = false
    getStorageEstimate(file).then((est) => {
      if (!cancelled) setCostEstimate(est)
    })
    warmTurboWalletLink(walletClient, () => {}).catch(() => {})
    return () => { cancelled = true }
  }, [file, walletClient, getStorageEstimate])

  async function handleFile(selected) {
    if (!selected) return
    try {
      await validateSealFileDeep(selected)
      setFile(selected)
      setPreview(null)
    } catch (error) {
      toast.error(vaultErrorMessage(error))
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFile(dropped)
  }

  async function handleUpload() {
    if (!file) return
    setLastError(null)
    try {
      const stored = await storeFile(file)
      toast.success('Saved to vault')

      const previewUrl = URL.createObjectURL(file)
      setPreview({
        url: previewUrl,
        fileName: stored.fileName,
        fileType: stored.fileType || file.type,
        cleanup: () => URL.revokeObjectURL(previewUrl),
      })

      onSuccess?.()
    } catch (error) {
      const msg = vaultErrorMessage(error)
      const detail = vaultErrorDetail(error)
      setLastError(detail && detail !== msg ? detail : msg)
      toast.error(msg, { id: 'vault-store-error', duration: 10000 })
      console.error('[ARKIVE] Vault store failed:', error)
    }
  }

  function handleDownload() {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = preview.fileName
    a.click()
  }

  function handleClose() {
    preview?.cleanup?.()
    onClose()
  }

  return (
    <>
      {SignPromptModal}
      <Modal onClose={handleClose}>
      <ModalHeader
        title={preview ? 'Stored' : 'Store to vault'}
        description={preview ? 'Saved to your vault.' : 'Encrypted on your device, stored permanently.'}
        onClose={handleClose}
        icon={Lock}
      />

      <ModalBody>
        {preview ? (
          <div className="space-y-4">
            <p className="status-pill status-pill-ok w-fit mx-auto">
              Wallet {address?.slice(0, 6)}…{address?.slice(-4)} verified
            </p>
            {preview.fileType?.startsWith('image/') && (
              <img
                src={preview.url}
                alt={preview.fileName}
                className="w-full rounded-xl max-h-72 object-contain bg-black/30 ring-1 ring-border"
              />
            )}
            <button type="button" onClick={handleDownload} className="btn-primary w-full">
              <Download size={16} />
              Download {preview.fileName}
            </button>
            <p className="font-mono text-[11px] text-text-muted text-center leading-relaxed">
              Also in your vault — retrieve anytime with Sign &amp; View
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Dropzone
              dragging={dragging}
              filled={!!file}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <>
                  <DropzoneIcon>
                    <Lock size={20} />
                  </DropzoneIcon>
                  <p className="font-body text-text-primary text-sm font-medium max-w-full truncate">
                    {file.name}
                  </p>
                  <p className="font-mono text-[11px] text-text-muted">
                    {formatFileSize(file.size)}
                  </p>
                </>
              ) : (
                <>
                  <DropzoneIcon>
                    <Upload size={20} />
                  </DropzoneIcon>
                  <p className="font-body text-text-primary text-sm">Drop a file or click to browse</p>
                  <p className="font-body text-text-muted text-xs">Up to 100 MB</p>
                </>
              )}
            </Dropzone>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

            <MetaMaskSignInlineNotice />

            {costEstimate?.paysEth && (
              <p className="font-body text-xs text-text-muted notice-inline">
                MetaMask may ask for a small storage fee.
              </p>
            )}

            {lastError && !loading && (
              <p className="font-mono text-[11px] text-red-400/90 notice-inline break-words">
                {lastError}
              </p>
            )}

            {loading && (
              <div className="space-y-2">
                {step && (
                  <div className="flex items-center gap-3 notice-inline">
                    <div className="h-4 w-4 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
                    <p className="font-body text-sm text-text-secondary">{friendlyStep(step)}</p>
                  </div>
                )}
                {uploadProgress > 0 && (
                  <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className={preview ? 'justify-stretch' : ''}>
        {preview ? (
          <button type="button" onClick={handleClose} className="btn-primary w-full">
            Done
          </button>
        ) : (
          <>
            <button type="button" onClick={handleClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || loading}
              className="btn-primary btn-primary-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock size={16} />
              {loading ? 'Storing…' : 'Encrypt & store'}
            </button>
          </>
        )}
      </ModalFooter>
    </Modal>
    </>
  )
}
