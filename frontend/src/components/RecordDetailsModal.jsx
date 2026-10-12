import toast from 'react-hot-toast'
import { useState } from 'react'
import {
  Archive,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileKey,
  Fingerprint,
  HardDrive,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { isDemoMode } from '../config/demo'
import { formatSealedDate, formatLastOpened } from '../demo/demoVault'
import { Modal, ModalBody, ModalHeader } from './Modal'

function short(value, start = 8, end = 7) {
  if (!value) return 'Pending'
  if (value.length <= start + end + 3) return value
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function CopyValue({ label, value }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { toast.error('Could not copy. Select the value and copy it manually.') }
  }

  return (
    <div className="proof-row">
      <div className="min-w-0">
        <p className="proof-label">{label}</p>
        <p className="proof-value" title={value}>{short(value)}</p>
      </div>
      <button type="button" onClick={copy} disabled={!value} className="icon-button" aria-label={`Copy ${label}`}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  )
}

export default function RecordDetailsModal({ record, onClose, onRetrieve, onCertificate, onTestRecovery }) {
  const txId = record.arweaveTxId || record.arweaveId || record.archiveId
  const wallet = record.walletAddress || record.owner
  const storedAt = record.sealedAt || (record.storedAt ? Number(record.storedAt) * 1000 : Date.now())
  const originalHash = record.originalContentHash || record.contentHash

  const steps = [
    { icon: FileKey, title: isDemoMode ? 'Encryption preview' : 'Encrypted on this device', detail: isDemoMode ? 'Demo file only. No encryption was performed.' : 'File contents were encrypted before upload.' },
    { icon: Wallet, title: isDemoMode ? 'Example owner' : 'Authorised by wallet', detail: wallet ? `Owner ${short(wallet, 6, 4)}` : 'Wallet ownership recorded.' },
    { icon: HardDrive, title: isDemoMode ? 'Sample storage identifier' : 'Stored on Arweave', detail: isDemoMode ? 'No file was uploaded to Arweave.' : txId ? `Transaction ${short(txId)}` : 'Storage transaction pending.' },
    { icon: CheckCircle2, title: 'Registered on Base', detail: isDemoMode ? 'Simulated in this demo workspace.' : 'Vault registry entry confirmed on Base Sepolia.' },
  ]

  return (
    <Modal onClose={onClose} size="max-w-2xl">
      <ModalHeader
        icon={Archive}
        title={record.fileName || 'Encrypted record'}
        description="Ownership, storage, and recovery details for this record."
        onClose={onClose}
      />
      <ModalBody>
        <div className="detail-status-row">
          <span className="status-badge status-badge-success"><ShieldCheck size={14} /> {isDemoMode ? 'Demo record' : 'Encrypted'}</span>
          <span className="status-badge"><Fingerprint size={14} /> {isDemoMode ? 'Sample proof' : 'Integrity recorded'}</span>
          <span className="status-badge">{record.fileType || 'File'}</span>
        </div>

        <section aria-labelledby="record-history-title" className="detail-section">
          <h3 id="record-history-title" className="detail-section-title">Provenance</h3>
          <ol className="provenance-list">
            {steps.map(({ icon: Icon, title, detail }, index) => (
              <li key={title} className="provenance-step">
                <span className="provenance-icon"><Icon size={16} /></span>
                <span className="min-w-0">
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <span className="provenance-index" aria-hidden="true">0{index + 1}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="record-proof-title" className="detail-section">
          <h3 id="record-proof-title" className="detail-section-title">Verification data</h3>
          <div className="proof-grid">
            <CopyValue label="Arweave transaction" value={txId} />
            <CopyValue label="Owner wallet" value={wallet} />
            {originalHash && <CopyValue label="Content hash" value={originalHash} />}
          </div>
          {txId && !isDemoMode && (
            <a className="text-link mt-3 inline-flex items-center gap-1.5" href={`https://arweave.net/${txId}`} target="_blank" rel="noreferrer">
              View on Arweave <ExternalLink size={14} />
            </a>
          )}
        </section>

        <dl className="record-facts">
          <div><dt>Stored</dt><dd>{formatSealedDate(storedAt)}</dd></div>
          <div><dt>Last opened</dt><dd>{formatLastOpened(record.lastOpenedAt)}</dd></div>
          <div><dt>Recovery</dt><dd>{record.recoveryWrap ? 'Passphrase enabled' : 'Wallet access'}</dd></div>
        </dl>

        <div className="detail-actions">
          <button type="button" onClick={onRetrieve} className="btn-primary">Open record</button>
          {onTestRecovery && <button type="button" onClick={onTestRecovery} className="btn-secondary"><ShieldCheck size={15} /> Test recovery</button>}
          {onCertificate && <button type="button" onClick={onCertificate} className="btn-secondary">View certificate</button>}
        </div>
      </ModalBody>
    </Modal>
  )
}
