import { useState } from 'react'
import { Image, FileText, Video, File, Eye, Trash2, ArrowUpRight } from 'lucide-react'
import { PermanentDot } from './PermanentDot'
import DecryptModal from './DecryptModal'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import toast from 'react-hot-toast'
import RecordDetailsModal from './RecordDetailsModal'
import RecoveryTestModal from './RecoveryTestModal'

const icons = { image: Image, video: Video, document: FileText, other: File }

export default function VaultFileCard({ file, onDeleted, view = 'grid' }) {
  const [showDecrypt, setShowDecrypt] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showRecoveryTest, setShowRecoveryTest] = useState(false)
  const { deleteVaultFile, loading } = useVault()
  const Icon = icons[file.fileType] || File
  const storedDate = new Date(Number(file.storedAt) * 1000).toLocaleDateString()

  async function handleDelete() {
    if (!window.confirm(`Remove "${file.fileName}" from your vault list?`)) return
    try {
      await deleteVaultFile(file.id)
      toast.success('Removed from vault')
      onDeleted?.()
    } catch (error) {
      toast.error(vaultErrorMessage(error))
    }
  }

  return (
    <>
      <article className={`record-card ${view === 'list' ? 'record-card-list' : ''}`}>
        <div className="record-card-main">
          <div className="record-file-icon"><Icon size={18} strokeWidth={1.5} /></div>
          <div className="record-card-copy">
            <h3 title={file.fileName}>{file.fileName}</h3>
            <p>Stored {storedDate}</p>
            <PermanentDot type="vault" />
          </div>
        </div>
        <div className="record-card-actions">
          <button type="button" onClick={() => setShowDetails(true)} className="btn-ghost btn-compact">
            Details <ArrowUpRight size={14} />
          </button>
          <button type="button" onClick={() => setShowDecrypt(true)} className="btn-secondary btn-compact">
            <Eye size={14} />
            Open
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="icon-button icon-button-danger"
            aria-label={`Remove ${file.fileName} from vault`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </article>

      {showDecrypt && <DecryptModal file={file} onClose={() => setShowDecrypt(false)} />}
      {showDetails && (
        <RecordDetailsModal
          record={file}
          onClose={() => setShowDetails(false)}
          onRetrieve={() => { setShowDetails(false); setShowDecrypt(true) }}
          onTestRecovery={() => { setShowDetails(false); setShowRecoveryTest(true) }}
        />
      )}
      {showRecoveryTest && <RecoveryTestModal record={file} onClose={() => setShowRecoveryTest(false)} />}
    </>
  )
}
