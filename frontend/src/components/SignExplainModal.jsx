import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'

/**
 * Shown in-app immediately before MetaMask personal_sign on raw upload bytes.
 * MetaMask will still display encoded text — this explains that it is expected.
 */
export default function SignExplainModal({ onContinue }) {
  return (
    <Modal onClose={onContinue} size="max-w-md" zIndex="z-[60]">
      <ModalHeader
        title="Approve storage signature"
        description="MetaMask is about to open — the message may look like random characters."
        onClose={onContinue}
      />
      <ModalBody>
        <p className="font-body text-sm text-text-secondary leading-relaxed">
          MetaMask will show <strong className="text-text-primary">encoded text</strong> — that is
          normal for permanent Arweave storage. Tap <strong className="text-text-primary">Sign</strong>{' '}
          to continue. This is <strong className="text-text-primary">not a transaction</strong> and does
          not move ETH.
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onContinue} className="btn-primary w-full">
          Continue to MetaMask
        </button>
      </ModalFooter>
    </Modal>
  )
}

export function MetaMaskSignInlineNotice() {
  return (
    <p className="font-body text-xs text-text-muted notice-inline">
      Next: approve a signature in MetaMask — encoded text is normal and not a transaction.
    </p>
  )
}
