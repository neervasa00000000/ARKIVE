import { useState } from 'react'
import { Lock, FileText, Image, Video, File, Award } from 'lucide-react'
import { formatSealedDate, formatLastOpened } from '../demo/demoVault'
import UnlockModal from './UnlockModal'
import PermanenceCertificate from './PermanenceCertificate'

const icons = { image: Image, video: Video, document: FileText, other: File }

export default function VaultRecordCard({ record, onOpened }) {
  const [showUnlock, setShowUnlock] = useState(false)
  const [showCert, setShowCert] = useState(false)
  const Icon = icons[record.fileType] || File

  return (
    <>
      <div className="panel-hover p-5 group cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="h-11 w-11 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-muted">
            <Icon size={18} strokeWidth={1.5} />
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowCert(true) }}
            className="p-2 rounded-lg text-faint hover:text-ink opacity-0 group-hover:opacity-100 transition-all"
            title="Certificate"
          >
            <Award size={15} />
          </button>
        </div>

        <p className="font-display font-medium text-ink text-sm truncate mb-1">{record.fileName}</p>
        <p className="text-xs text-faint mb-4">Sealed {formatSealedDate(record.sealedAt)}</p>

        <button
          type="button"
          onClick={() => setShowUnlock(true)}
          className="btn-secondary w-full py-2 text-xs mt-2"
        >
          <Lock size={14} />
          Retrieve
        </button>

        <p className="font-mono text-[10px] text-faint mt-3">
          Last opened {formatLastOpened(record.lastOpenedAt)}
        </p>
      </div>

      {showUnlock && (
        <UnlockModal
          record={record}
          onClose={() => setShowUnlock(false)}
          onOpened={() => { onOpened?.(record.id); setShowUnlock(false) }}
        />
      )}
      {showCert && <PermanenceCertificate record={record} onClose={() => setShowCert(false)} />}
    </>
  )
}
