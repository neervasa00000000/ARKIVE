import { useState } from 'react'
import { Image, FileText, Video, File, Eye, Trash2 } from 'lucide-react'
import { PermanentDot } from './PermanentDot'
import DecryptModal from './DecryptModal'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import toast from 'react-hot-toast'

const icons = { image: Image, video: Video, document: FileText, other: File }

export default function VaultFileCard({ file, onDeleted }) {
  const [showDecrypt, setShowDecrypt] = useState(false)
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
      <div className="panel-hover p-5 group">
        <div className="h-11 w-11 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-muted mb-4">
          <Icon size={18} strokeWidth={1.5} />
        </div>

        <p className="font-display font-medium text-ink text-sm truncate mb-1">{file.fileName}</p>
        <p className="text-xs text-faint mb-3">{storedDate}</p>
        <PermanentDot type="vault" />

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => setShowDecrypt(true)} className="btn-secondary flex-1 py-2 text-xs">
            <Eye size={14} />
            Open
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="p-2 rounded-xl border border-line text-faint hover:text-ink hover:border-line-strong transition-colors disabled:opacity-40"
            title="Remove entry"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showDecrypt && <DecryptModal file={file} onClose={() => setShowDecrypt(false)} />}
    </>
  )
}
