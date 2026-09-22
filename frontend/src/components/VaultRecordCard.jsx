import { useState } from 'react'
import { Lock, FileText, Image, Video, File, ArrowUpRight } from 'lucide-react'
import { formatSealedDate, formatLastOpened } from '../demo/demoVault'
import UnlockModal from './UnlockModal'
import PermanenceCertificate from './PermanenceCertificate'
import RecordDetailsModal from './RecordDetailsModal'

const icons = { image: Image, video: Video, document: FileText, other: File }

export default function VaultRecordCard({ record, onOpened, view = 'grid' }) {
  const [showUnlock, setShowUnlock] = useState(false)
  const [showCert, setShowCert] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const Icon = icons[record.fileType] || File
  const proofId = record.arweaveTxId ? `${record.arweaveTxId.slice(0, 5)}...${record.arweaveTxId.slice(-4)}` : 'Pending'

  return (
    <>
      <article className={`record-card ${view === 'list' ? 'record-card-list' : ''}`}>
        <div className="record-card-main">
          <div className={`record-file-icon record-file-${record.fileType || 'other'}`}>
            <Icon size={18} strokeWidth={1.5} />
          </div>
          <div className="record-card-copy">
            <h3 title={record.fileName}>{record.fileName}</h3>
            <p>Stored {formatSealedDate(record.sealedAt)} · Opened {formatLastOpened(record.lastOpenedAt)}</p>
            <div className="record-proof-row">
              <span className="record-proof"><span className="proof-dot" />Encrypted</span>
              <span className="record-chain">AR {proofId}</span>
            </div>
          </div>
        </div>
        <div className="record-card-actions">
          <button type="button" onClick={() => setShowDetails(true)} className="btn-ghost btn-compact">
            Details <ArrowUpRight size={14} />
          </button>
          <button type="button" onClick={() => setShowUnlock(true)} className="btn-secondary btn-compact">
            <Lock size={14} /> Open
          </button>
        </div>
      </article>

      {showUnlock && (
        <UnlockModal
          record={record}
          onClose={() => setShowUnlock(false)}
          onOpened={() => { onOpened?.(record.id); setShowUnlock(false) }}
        />
      )}
      {showCert && <PermanenceCertificate record={record} onClose={() => setShowCert(false)} />}
      {showDetails && (
        <RecordDetailsModal
          record={record}
          onClose={() => setShowDetails(false)}
          onRetrieve={() => { setShowDetails(false); setShowUnlock(true) }}
          onCertificate={() => { setShowDetails(false); setShowCert(true) }}
        />
      )}
    </>
  )
}
