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
  if (s.includes('vault key') || s.includes('backup vault')) return 'Approve vault key in MetaMask…'
  if (s.includes('storage payment') || s.includes(' eth ')) return 'Approve ETH payment in MetaMask…'
  if (s.includes('payment confirming')) return 'Payment confirming…'
  if (s.includes('metamask') || s.includes('approve')) return 'Check MetaMask…'
  if (s.includes('blockchain') || s.includes('register')) return 'Saving record…'
  if (s.includes('storage') || s.includes('credit')) return 'Preparing storage…'
  return 'Working…'
}

function BackupWalletField({
  label,
  value,
  onChange,
  authorised,
  onAuthorise,
  loading,
}) {
  return (
    <div>
      <label className="font-body text-xs text-text-secondary block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0x… — another wallet that can open this file"
        className="input-field text-sm font-mono"
      />
      {value.trim() && (
        <button
          type="button"
          onClick={onAuthorise}
          disabled={loading || authorised}
          className="btn-secondary btn-primary-sm mt-2 disabled:opacity-50"
        >
          {authorised ? 'Authorised' : '1. Switch MetaMask to this wallet → Authorise'}
        </button>
      )}
      {authorised && (
        <p className="font-body text-[11px] text-text-muted mt-2">
          2. Switch MetaMask back to your main wallet before Encrypt &amp; store.
        </p>
      )}
    </div>
  )
}

export default function UploadModal({ onClose, onSuccess }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [costEstimate, setCostEstimate] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [backup1, setBackup1] = useState('')
  const [backup2, setBackup2] = useState('')
  const [backup1Authorised, setBackup1Authorised] = useState(false)
  const [backup2Authorised, setBackup2Authorised] = useState(false)
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const fileRef = useRef()
  const { storeFile, authorizeBackupWallet, getStorageEstimate, loading, step, uploadProgress, SignPromptModal } =
    useVault()

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

  useEffect(() => {
    setBackup1Authorised(false)
  }, [backup1])

  useEffect(() => {
    setBackup2Authorised(false)
  }, [backup2])

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

  async function handleAuthorizeBackup(slot) {
    const raw = slot === 1 ? backup1.trim() : backup2.trim()
    try {
      await authorizeBackupWallet(raw)
      if (slot === 1) setBackup1Authorised(true)
      else setBackup2Authorised(true)
      toast.success('Backup wallet authorised — switch back to your main wallet, then store')
    } catch (error) {
      toast.error(vaultErrorMessage(error))
    }
  }

  async function handleUpload() {
    if (!file) return
    setLastError(null)
    try {
      const opts = { backupAddresses: [] }
      const slots = [
        { raw: backup1.trim(), authorised: backup1Authorised },
        { raw: backup2.trim(), authorised: backup2Authorised },
      ]
      for (const slot of slots) {
        if (!slot.raw) continue
        if (!slot.authorised) {
          toast.error('Authorise each backup wallet first (switch to it in MetaMask)')
          return
        }
        opts.backupAddresses.push(slot.raw)
      }
      if (recoveryPassphrase.trim()) {
        opts.recoveryPassphrase = recoveryPassphrase
      }
      const stored = await storeFile(file, opts)
      toast.success('Saved to vault')

      if (stored.offlinePackage && stored.offlineFileName) {
        const blob = new Blob([stored.offlinePackage], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = stored.offlineFileName
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Offline recovery copy (.arkive) downloaded — keep it safe', { duration: 6000 })
      }

      const previewUrl = URL.createObjectURL(file)
      setPreview({
        url: previewUrl,
        fileName: stored.fileName,
        fileType: stored.fileType || file.type,
        arweaveId: stored.arweaveId,
        offlineFileName: stored.offlineFileName,
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
            {preview.arweaveId && (
              <p className="font-mono text-[10px] text-text-muted text-center break-all px-2">
                Archive ID: {preview.arweaveId}
              </p>
            )}
            {preview.offlineFileName && (
              <p className="font-body text-[11px] text-text-secondary text-center leading-relaxed">
                An offline <span className="font-mono">.arkive</span> recovery copy was saved to your downloads.
                Keep it (and your seed / passphrase) independent of this website.
              </p>
            )}
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

            <button
              type="button"
              onClick={() => setShowRecovery((v) => !v)}
              className="font-body text-xs text-text-muted underline-offset-2 hover:text-text-secondary hover:underline"
            >
              {showRecovery ? 'Hide recovery options' : 'Add recovery options (recommended)'}
            </button>

            {showRecovery && (
              <div className="space-y-3 notice-inline">
                <p className="font-body text-[11px] text-text-secondary leading-relaxed">
                  ARKIVE cannot recover your archive if all authorised wallets are lost.
                  Add up to two backup wallets and store their recovery credentials safely.
                </p>
                <div>
                  <label className="font-body text-xs text-text-secondary block mb-1">
                    Recovery passphrase (optional)
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={recoveryPassphrase}
                    onChange={(e) => setRecoveryPassphrase(e.target.value)}
                    placeholder="Min 8 characters — store offline"
                    className="input-field text-sm"
                  />
                </div>
                <BackupWalletField
                  label="Backup wallet 1 (optional)"
                  value={backup1}
                  onChange={setBackup1}
                  authorised={backup1Authorised}
                  onAuthorise={() => handleAuthorizeBackup(1)}
                  loading={loading}
                />
                <BackupWalletField
                  label="Backup wallet 2 (optional)"
                  value={backup2}
                  onChange={setBackup2}
                  authorised={backup2Authorised}
                  onAuthorise={() => handleAuthorizeBackup(2)}
                  loading={loading}
                />
              </div>
            )}

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
