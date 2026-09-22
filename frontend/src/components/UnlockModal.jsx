import { useState } from 'react'
import { Lock, Download, FileText } from 'lucide-react'
import { isDemoMode } from '../config/demo'
import { simulateUnlockProgress } from '../demo/demoVault'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import { Modal, ModalHeader, ModalBody } from './Modal'
import toast from 'react-hot-toast'

export default function UnlockModal({ record, onClose, onOpened }) {
  const [phase, setPhase] = useState('locked')
  const [decrypted, setDecrypted] = useState(null)
  const { retrieveAndDecryptFile, loading } = useVault()

  async function handleSign() {
    setPhase('signing')

    if (isDemoMode) {
      await simulateUnlockProgress(() => {})
      await delay(800)
      setPhase('opening')
      await delay(1000)
      setDecrypted({
        fileName: record.fileName,
        url: null,
        fileType: record.fileType === 'image' ? 'image/png' : 'application/octet-stream',
        demo: true,
      })
      setPhase('unlocked')
      onOpened?.()
      return
    }

    try {
      const result = await retrieveAndDecryptFile(
        record.encryptedArweaveId || record.arweaveTxId,
        false,
      )
      setPhase('opening')
      await delay(600)
      setDecrypted(result)
      setPhase('unlocked')
      onOpened?.()
    } catch (error) {
      toast.error(vaultErrorMessage(error))
      setPhase('locked')
    }
  }

  function handleDownload() {
    if (isDemoMode) {
      const blob = new Blob(
        [`ARKIVE Demo — ${record.fileName}\n\nThis is a simulated retrieval. In production, your decrypted file would download here.`],
        { type: 'text/plain' },
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = record.fileName.replace(/\.[^.]+$/, '') + '-demo.txt'
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    if (!decrypted?.url) return
    const a = document.createElement('a')
    a.href = decrypted.url
    a.download = decrypted.fileName
    a.click()
  }

  function handleClose() {
    decrypted?.cleanup?.()
    onClose()
  }

  const subtitles = {
    locked: 'Your wallet proves ownership. Decryption stays on your device.',
    signing: 'Confirm in MetaMask…',
    opening: 'Decrypting…',
    unlocked: record.fileName,
  }

  return (
    <Modal onClose={handleClose}>
      <ModalHeader
        title={phase === 'unlocked' ? 'Unlocked' : 'Retrieve record'}
        description={subtitles[phase]}
        onClose={handleClose}
        icon={Lock}
      />

      <ModalBody className="py-6">
        {phase === 'locked' && (
          <div className="text-center max-w-xs mx-auto">
            <div className="dropzone-icon h-16 w-16 mx-auto mb-6">
              <Lock size={28} />
            </div>
            <button
              type="button"
              onClick={handleSign}
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              <Lock size={16} />
              Sign to unlock
            </button>
          </div>
        )}

        {phase === 'signing' && (
          <div className="text-center py-6">
            <div className="h-11 w-11 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <p className="font-display text-text-primary text-sm">Awaiting signature</p>
          </div>
        )}

        {phase === 'opening' && (
          <div className="text-center py-6">
            <div className="relative mx-auto mb-5 h-20 w-20 lock-open-animation">
              <div className="absolute inset-0 rounded-full border-2 border-brand/25" />
              <div className="absolute inset-3 flex items-center justify-center">
                <Lock size={28} className="text-text-secondary lock-shackle" />
              </div>
            </div>
            <p className="font-display text-text-primary text-sm">Unlocking…</p>
          </div>
        )}

        {phase === 'unlocked' && (
          <div className="text-center animate-fade-in space-y-4">
            <div className="dropzone-icon h-14 w-14 mx-auto">
              <FileText size={24} />
            </div>
            <button type="button" onClick={handleDownload} className="btn-primary w-full py-3">
              <Download size={16} />
              Download
            </button>
            <p className="font-mono text-[10px] text-text-muted leading-relaxed px-2">
              Permanent on Arweave — that is the point.
            </p>
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
