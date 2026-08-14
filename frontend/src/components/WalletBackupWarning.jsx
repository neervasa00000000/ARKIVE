import { AlertTriangle } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'

export default function WalletBackupWarning({ onYes, onNo }) {
  return (
    <Modal onClose={onNo} zIndex="z-[60]">
      <ModalHeader
        title="Before you seal"
        description="If you lose this wallet, you lose this vault. Forever. Have you backed up your seed phrase?"
        icon={AlertTriangle}
      />
      <ModalFooter className="justify-stretch gap-3">
        <button type="button" onClick={onNo} className="btn-secondary flex-1">Not yet</button>
        <button type="button" onClick={onYes} className="btn-primary flex-1">Yes, backed up</button>
      </ModalFooter>
    </Modal>
  )
}

export function WalletBackupGuidance({ onContinue, onCancel }) {
  return (
    <Modal onClose={onCancel} zIndex="z-[60]">
      <ModalHeader
        title="Back up your wallet first"
        description="Your 12 or 24-word seed phrase is the only recovery path. Write it on paper. Never share it."
      />
      <ModalBody className="pt-0">
        <p className="font-body text-text-muted text-xs leading-relaxed">
          Without your seed phrase, sealed records stay locked — even for you.
        </p>
      </ModalBody>
      <ModalFooter className="justify-stretch gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Go back</button>
        <button type="button" onClick={onContinue} className="btn-primary flex-1">I understand</button>
      </ModalFooter>
    </Modal>
  )
}
