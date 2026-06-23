import { useState, useRef } from 'react'
import { X, Upload, Lock } from 'lucide-react'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import toast from 'react-hot-toast'

export default function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()
  const { storeFile, loading, step } = useVault()

  function handleFile(selected) {
    if (selected) setFile(selected)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  async function handleUpload() {
    if (!file) return
    try {
      toast('Dual encrypting with Lit + wallet fallback...', { icon: '🔐' })
      await storeFile(file)
      toast.success('File encrypted and stored permanently on Arweave')
      onSuccess?.()
    } catch (error) {
      toast.error(vaultErrorMessage(error))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-elevated border border-border rounded-2xl w-full max-w-lg animate-slide-up">

        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-text-primary">Store to Vault</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current.click()}
            className={`w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              dragging
                ? 'border-purple-400 bg-purple-500/10'
                : file
                ? 'border-purple-500/40 bg-purple-500/5'
                : 'border-border hover:border-purple-500/40 hover:bg-purple-500/5'
            }`}
          >
            {file ? (
              <>
                <Lock size={24} className="text-purple-400" />
                <p className="font-body text-text-primary text-sm font-medium">{file.name}</p>
                <p className="font-body text-text-muted text-xs">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <Upload size={24} className="text-text-muted" />
                <p className="font-body text-text-secondary text-sm">Drop file here or click to select</p>
                <p className="font-body text-text-muted text-xs">Any file type supported</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mt-4">
            <div className="flex items-start gap-3">
              <Lock size={16} className="text-purple-400 mt-0.5" />
              <div>
                <p className="font-body text-purple-300 text-xs leading-relaxed">
                  File is AES-encrypted, then the key is secured via Lit Protocol and a wallet-derived fallback.
                  Both paths are stored in every Arweave payload.
                </p>
                {loading && step && (
                  <p className="font-mono text-xs text-purple-200/80 mt-2">{step}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 font-body text-sm text-text-secondary hover:text-text-primary">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex items-center gap-2 bg-purple-500 text-white px-5 py-2.5 rounded-xl font-display font-semibold text-sm hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Lock size={16} />
            {loading ? 'Encrypting...' : 'Encrypt and Store'}
          </button>
        </div>
      </div>
    </div>
  )
}
