import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Upload, Lock, AlertTriangle } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import VaultRegistryABI from '../contracts/VaultRegistry.json'
import VaultFileCard from '../components/VaultFileCard'
import UploadModal from '../components/UploadModal'
import { getSetupStatus } from '../lib/setupStatus'

export default function Vault() {
  const { address } = useAccount()
  const [showUpload, setShowUpload] = useState(false)
  const setup = getSetupStatus()

  const { data: files, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.VaultRegistry,
    abi: VaultRegistryABI.abi,
    functionName: 'getMyFiles',
    account: address,
  })

  return (
    <div className="max-w-3xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={20} className="text-purple-400" />
            <h1 className="font-display text-2xl font-bold text-text-primary">Vault</h1>
          </div>
          <p className="font-body text-text-secondary text-sm">
            Files encrypted with your wallet. Only you can open them. Stored on Arweave forever.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          disabled={!setup.ready}
          className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2.5 rounded-xl font-display font-semibold text-sm hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload size={18} />
          Store File
        </button>
      </div>

      {!setup.ready && (
        <div className="bg-card border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-sm font-semibold text-amber-300 mb-1">Backend not configured</p>
            <ul className="font-body text-text-secondary text-sm space-y-1 list-disc list-inside">
              {setup.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="font-mono text-text-muted text-xs mt-2">
              Deploy contracts → set .env → npm run build:arkive-preview → push
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-purple-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="mt-0.5">
          <Lock size={16} className="text-purple-400" />
        </div>
        <p className="font-body text-text-secondary text-sm leading-relaxed">
          Your files are encrypted twice. Even if every ARKIVE system disappears, your 12-word seed phrase and any browser with MetaMask is enough to get everything back from Arweave — forever.
        </p>
      </div>

      {!files || files.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Lock size={32} className="text-text-muted mx-auto mb-4" />
          <p className="font-body text-text-secondary mb-2">Your vault is empty</p>
          <p className="font-body text-text-muted text-sm">Upload any file. It will be encrypted and stored permanently.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <VaultFileCard
              key={file.id.toString()}
              file={file}
              onDeleted={refetch}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); refetch() }}
        />
      )}
    </div>
  )
}
