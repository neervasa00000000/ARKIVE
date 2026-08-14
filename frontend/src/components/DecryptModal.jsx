import { useState, useEffect } from 'react'
import { Lock, Download, Shield, AlertTriangle } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import { sanitizeFileName, needsDownloadWarning } from '../lib/security'
import { hasLocalVaultBundle } from '../lib/vaultLocal'
import { Modal, ModalHeader, ModalBody } from './Modal'
import toast from 'react-hot-toast'

export default function DecryptModal({ file, onClose }) {
  const { address } = useAccount()
  const { retrieveAndDecryptFile, loading, step } = useVault()
  const [decrypted, setDecrypted] = useState(null)
  const [localReady, setLocalReady] = useState(null)
  const [downloadConfirm, setDownloadConfirm] = useState(false)

  const arweaveId = file.encryptedArweaveId

  useEffect(() => {
    let cancelled = false
    hasLocalVaultBundle(arweaveId).then((ok) => {
      if (!cancelled) setLocalReady(ok)
    })
    return () => { cancelled = true }
  }, [arweaveId])

  async function handleView() {
    try {
      const result = await retrieveAndDecryptFile(arweaveId)
      setDecrypted(result)
      toast.success('Unlocked')
    } catch (error) {
      toast.error(vaultErrorMessage(error), { duration: 8000 })
    }
  }

  function performDownload() {
    if (!decrypted) return
    const a = document.createElement('a')
    a.href = decrypted.url
    a.download = sanitizeFileName(decrypted.fileName)
    a.rel = 'noopener'
    a.click()
    setDownloadConfirm(false)
  }

  function handleDownload() {
    if (!decrypted) return
    if (needsDownloadWarning(decrypted.fileType)) {
      setDownloadConfirm(true)
      return
    }
    performDownload()
  }

  function handleClose() {
    decrypted?.cleanup?.()
    onClose()
  }

  const walletShort = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'not connected'

  return (
    <Modal onClose={handleClose}>
      <ModalHeader
        title={sanitizeFileName(file.fileName)}
        description={decrypted ? 'Decrypted in this session only.' : `Sign with wallet ${walletShort} to unlock.`}
        onClose={handleClose}
        icon={Lock}
      />

      <ModalBody>
        {!decrypted ? (
          <div className="space-y-4">
            {localReady === false && (
              <p className="status-pill status-pill-warn w-full text-left text-xs leading-relaxed">
                No local copy on this browser — delete this entry and use Store file again.
              </p>
            )}
            {localReady === true && (
              <p className="status-pill status-pill-ok w-full text-left text-xs">
                Ready on this device — opens after you sign.
              </p>
            )}

            {loading && step && (
              <div className="notice-inline flex items-center gap-3">
                <div className="h-4 w-4 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-mono text-[11px] text-text-secondary">{step}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleView}
              disabled={loading || !address}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock size={16} />
              {loading ? 'Opening…' : 'Sign & view'}
            </button>

            <div className="notice-inline">
              <div className="flex items-start gap-2">
                <Shield size={14} className="text-text-muted mt-0.5 shrink-0" />
                <p className="font-mono text-[11px] text-text-muted leading-relaxed">
                  Arweave ID: {arweaveId?.slice(0, 12)}…
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="status-pill status-pill-ok w-fit mx-auto">
              Verified {walletShort}
            </p>

            {decrypted.fileType?.startsWith('image/') && (
              <img
                src={decrypted.url}
                alt={decrypted.fileName}
                className="w-full rounded-xl max-h-80 object-contain bg-black/30 ring-1 ring-border"
              />
            )}
            {decrypted.fileType === 'application/pdf' && (
              <iframe
                src={decrypted.url}
                className="w-full h-64 rounded-xl ring-1 ring-border"
                title={decrypted.fileName}
                sandbox=""
              />
            )}
            {!decrypted.fileType?.startsWith('image/') && decrypted.fileType !== 'application/pdf' && (
              <div className="notice-inline text-center py-8">
                <p className="font-body text-text-secondary text-sm">File unlocked. Download to open.</p>
              </div>
            )}

            {downloadConfirm ? (
              <div className="notice-inline space-y-3 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Only download files you sealed yourself. Opening unknown files on your device can run malware.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDownloadConfirm(false)} className="btn-ghost flex-1 text-xs">
                    Cancel
                  </button>
                  <button type="button" onClick={performDownload} className="btn-primary flex-1 text-xs">
                    Download anyway
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={handleDownload} className="btn-primary w-full">
                <Download size={16} />
                Download {sanitizeFileName(decrypted.fileName)}
              </button>
            )}

            <p className="font-mono text-[11px] text-text-muted text-center">
              Cleared from memory when you close this window
            </p>
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}
