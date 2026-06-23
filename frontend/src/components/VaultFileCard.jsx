import { useState } from 'react'
import { Lock, Image, FileText, Video, File, Eye } from 'lucide-react'
import { PermanentDot } from './PermanentDot'
import DecryptModal from './DecryptModal'

const icons = { image: Image, video: Video, document: FileText, other: File }

export default function VaultFileCard({ file, onDeleted }) {
  const [showDecrypt, setShowDecrypt] = useState(false)
  const Icon = icons[file.fileType] || File

  const storedDate = new Date(Number(file.storedAt) * 1000).toLocaleDateString()

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-4 hover:border-purple-500/30 transition-colors group">

        <div className="h-12 w-12 bg-elevated border border-purple-500/20 rounded-xl flex items-center justify-center mb-4">
          <Icon size={22} className="text-purple-400" />
        </div>

        <p className="font-display text-sm font-semibold text-text-primary mb-1 truncate">
          {file.fileName}
        </p>
        <p className="font-body text-text-muted text-xs mb-4">{storedDate}</p>

        <PermanentDot type="vault" />

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setShowDecrypt(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg py-2 text-xs font-medium hover:bg-purple-500/20 transition-colors"
          >
            <Eye size={14} />
            Open
          </button>
        </div>
      </div>

      {showDecrypt && (
        <DecryptModal
          file={file}
          onClose={() => setShowDecrypt(false)}
        />
      )}
    </>
  )
}
