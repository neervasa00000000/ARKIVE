import { useState, useEffect, useRef } from 'react'
import { Lock, Download, AlertTriangle } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import { sanitizeFileName, needsDownloadWarning } from '../lib/security'
import { Link } from 'react-router-dom'
import { Modal, ModalHeader, ModalBody } from './Modal'

export default function DecryptModal({ file, onClose }) {
  const { address, connector } = useAccount()
  const { retrieveAndDecryptFile, loading, step } = useVault()
  const [decrypted, setDecrypted] = useState(null)
  const [error, setError] = useState('')
  const [downloadConfirm, setDownloadConfirm] = useState(false)

  const session = `${connector?.uid || ''}:${address || ''}`
  const activeSession = useRef(session)
  activeSession.current = session
  const requestVersion = useRef(0)
  useEffect(() => {
    requestVersion.current += 1
    setDecrypted(null)
    setError('')
    setDownloadConfirm(false)
    return () => { requestVersion.current += 1 }
  }, [session])

  const arweaveId = file.encryptedArweaveId

  useEffect(() => () => decrypted?.cleanup?.(), [decrypted])

  async function handleView() {
    setError('')
    const version = ++requestVersion.current
    const startedSession = session
    try {
      const result = await retrieveAndDecryptFile(arweaveId)
      if (version !== requestVersion.current || startedSession !== activeSession.current) {
        result.cleanup?.()
        return
      }
      setDecrypted(result)
    } catch (error) {
      if (version === requestVersion.current && startedSession === activeSession.current) setError(vaultErrorMessage(error))
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
        title={sanitizeFileName(decrypted?.fileName || file.fileName)}
        description={decrypted ? 'Decrypted on this device.' : 'Approve a wallet signature to open this file.'}
        onClose={handleClose}
        icon={Lock}
      />

      <ModalBody>
        {!decrypted ? (
          <div className="space-y-4">
            {loading && step && (
              <div role="status" className="flex items-center gap-3 text-sm text-muted">
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

            {error && (
              <div role="alert" className="text-sm leading-relaxed text-amber-200">
                <p>{error}</p>
                <Link to="/recover" className="underline inline-block mt-2">Use an offline backup</Link>
              </div>
            )}
            <details className="text-xs text-text-muted">
              <summary className="cursor-pointer py-2 focus-visible:outline focus-visible:outline-2">File details</summary>
              <dl className="space-y-2 mt-2">
                <div><dt>Wallet</dt><dd className="font-mono">{walletShort}</dd></div>
                <div><dt>Archive ID</dt><dd className="font-mono break-all select-all">{arweaveId}</dd></div>
              </dl>
            </details>
          </div>
        ) : (
          <div className="space-y-4">
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
                Download file
              </button>
            )}

            <p className="font-mono text-[11px] text-text-muted text-center">
              Close this window when you’re finished.
            </p>
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}
