import { useState, useRef } from 'react'
import { Lock, FileUp } from 'lucide-react'
import { isDemoMode } from '../config/demo'
import { validateSealFileDeep } from '../lib/security'
import { useDemoWallet } from '../context/DemoWalletContext'
import { useDemoVault } from '../context/DemoVaultContext'
import { simulateSealProgress } from '../demo/demoVault'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage, vaultErrorDetail } from '../lib/setupStatus'
import SealProgress from './SealProgress'
import WalletBackupWarning, { WalletBackupGuidance } from './WalletBackupWarning'
import { WalletUploadNotice, VaultKeySignNotice } from './WalletUploadNotice'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'
import { MetaMaskSignInlineNotice } from './SignExplainModal'
import Dropzone, { DropzoneIcon } from './Dropzone'
import toast from 'react-hot-toast'

export default function SealModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState('select') // select | backup | guidance | sealing | complete
  const [sealStep, setSealStep] = useState(0)
  const [lastError, setLastError] = useState(null)
  const [sealedRecord, setSealedRecord] = useState(null)
  const fileRef = useRef()

  const demoWallet = useDemoWallet()
  const { addRecord } = useDemoVault()
  const { storeFile, loading, step, SignPromptModal } = useVault()

  async function handleFile(selected) {
    if (!selected) return
    try {
      await validateSealFileDeep(selected)
      setFile(selected)
    } catch (error) {
      toast.error(vaultErrorMessage(error))
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  function handleSealClick() {
    if (!file) return
    if (isDemoMode && !demoWallet.hasAcknowledgedBackup()) {
      setPhase('backup')
      return
    }
    startSeal()
  }

  function handleBackupYes() {
    demoWallet.acknowledgeBackup()
    setPhase('select')
    startSeal()
  }

  function handleBackupNo() {
    setPhase('guidance')
  }

  async function startSeal() {
    setPhase('sealing')
    setSealStep(0)

    if (isDemoMode) {
      await simulateSealProgress((step) => setSealStep(step))
      const record = addRecord(file)
      setSealedRecord(record)
      setPhase('complete')
      return
    }

    setLastError(null)
    try {
      toast('Encrypting locally — approve every MetaMask prompt (can take 1–2 min first time)', {
        icon: '🔐',
        duration: 6000,
      })
      await storeFile(file)
      setPhase('complete')
      onSuccess?.()
    } catch (error) {
      const msg = vaultErrorMessage(error)
      const detail = vaultErrorDetail(error)
      setLastError(detail || msg)
      toast.error(msg, { duration: 8000 })
      if (detail && detail !== msg) {
        console.error('Vault store detail:', detail)
      }
      setPhase('select')
    }
  }

  return (
    <>
      {SignPromptModal}
      <Modal onClose={onClose}>
        <ModalHeader
          title={phase === 'complete' ? 'Sealed' : 'Seal a record'}
          description={
            phase === 'sealing'
              ? 'Encrypting and writing to Arweave…'
              : phase === 'complete'
                ? 'This record is permanent.'
                : 'Encrypted on your device before it leaves your browser.'
          }
          onClose={onClose}
          icon={Lock}
        />

        <ModalBody>
          {phase === 'select' && (
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
                    <DropzoneIcon><Lock size={20} /></DropzoneIcon>
                    <p className="font-body text-text-primary text-sm font-medium max-w-full truncate">{file.name}</p>
                    <p className="font-mono text-[11px] text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <DropzoneIcon><FileUp size={20} /></DropzoneIcon>
                    <p className="font-body text-text-primary text-sm">Drop a record or click to browse</p>
                  </>
                )}
              </Dropzone>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

              <WalletUploadNotice context="vault" />
              <VaultKeySignNotice />
              <MetaMaskSignInlineNotice />
              {lastError && (
                <p className="notice-inline text-red-400/90 text-xs break-words border-red-500/20 bg-red-500/5">
                  {lastError}
                </p>
              )}
            </div>
          )}

          {phase === 'sealing' && (
            <div className="py-2">
              <SealProgress currentStep={sealStep} />
              {!isDemoMode && step && (
                <p className="font-mono text-[11px] text-text-muted mt-4">{step}</p>
              )}
            </div>
          )}

          {phase === 'complete' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="dropzone-icon mx-auto mb-4 h-14 w-14">
                <Lock size={26} />
              </div>
              <p className="font-display text-lg font-semibold text-text-primary mb-1">Stored forever</p>
              <p className="font-body text-text-secondary text-sm">Last opened: never</p>
              {sealedRecord && (
                <p className="font-mono text-[11px] text-text-muted mt-3 break-all px-2">
                  {sealedRecord.arweaveTxId}
                </p>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter className={phase === 'complete' ? 'justify-stretch' : ''}>
          {phase === 'select' && (
            <>
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={handleSealClick}
                disabled={!file || loading}
                className="btn-primary btn-primary-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock size={16} />
                Seal record
              </button>
            </>
          )}
          {phase === 'complete' && (
            <button type="button" onClick={() => { onSuccess?.(); onClose() }} className="btn-primary w-full">
              Return to vault
            </button>
          )}
        </ModalFooter>
      </Modal>

      {phase === 'backup' && (
        <WalletBackupWarning
          onYes={handleBackupYes}
          onNo={handleBackupNo}
        />
      )}

      {phase === 'guidance' && (
        <WalletBackupGuidance
          onCancel={() => setPhase('select')}
          onContinue={() => {
            demoWallet.acknowledgeBackup()
            setPhase('select')
            startSeal()
          }}
        />
      )}
    </>
  )
}
