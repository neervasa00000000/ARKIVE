import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWalletClient } from 'wagmi'
import { Upload, Lock, AlertTriangle } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import VaultRegistryABI from '../contracts/VaultRegistry.json'
import VaultFileCard from '../components/VaultFileCard'
import VaultRecordCard from '../components/VaultRecordCard'
import UploadModal from '../components/UploadModal'
import SealModal from '../components/SealModal'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { getSetupStatus } from '../lib/setupStatus'
import { warmTurboForWallet } from '../lib/turboUpload'
import { isDemoMode } from '../config/demo'
import { useDemoVault } from '../context/DemoVaultContext'

function DemoVaultPage() {
  const { records, initVault, markOpened } = useDemoVault()
  const [showSeal, setShowSeal] = useState(false)

  useEffect(() => { initVault() }, [initVault])

  return (
    <>
      <PageHeader
        title="Vault"
        description="Encrypted with your wallet. Retrieved only when you sign."
        action={(
          <button type="button" onClick={() => setShowSeal(true)} className="btn-primary btn-primary-sm">
            <Upload size={17} />
            Seal record
          </button>
        )}
      />

      {records.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="Vault is empty"
          description="Seal a file — it encrypts on your device, then lives on Arweave forever."
          action={(
            <button type="button" onClick={() => setShowSeal(true)} className="btn-primary btn-primary-sm">
              <Upload size={17} />
              Seal your first record
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {records.map((record) => (
            <VaultRecordCard key={record.id} record={record} onOpened={(id) => markOpened(id)} />
          ))}
        </div>
      )}

      {showSeal && <SealModal onClose={() => setShowSeal(false)} onSuccess={() => setShowSeal(false)} />}
    </>
  )
}

function LiveVaultPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [showUpload, setShowUpload] = useState(false)
  const setup = getSetupStatus({ walletConnected: isConnected })

  useEffect(() => {
    if (walletClient) warmTurboForWallet(walletClient)
  }, [walletClient])

  const { data: files, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.VaultRegistry,
    abi: VaultRegistryABI.abi,
    functionName: 'getMyFiles',
    account: address,
  })

  return (
    <>
      <PageHeader
        title="Vault"
        description="Only your wallet opens these files. Stored on Arweave forever."
        action={(
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            disabled={!setup.ready}
            className="btn-primary btn-primary-sm disabled:opacity-40"
          >
            <Upload size={17} />
            Store file
          </button>
        )}
      />

      {!setup.ready && (
        <div className="callout callout-warn mb-8">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-100 mb-2">Setup incomplete</p>
            <ul className="text-sm space-y-1 list-disc list-inside opacity-90">
              {setup.missing.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      )}

      {!files || files.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="Vault is empty"
          description="Upload any file. Encrypted locally, permanent on Arweave."
          action={(
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              disabled={!setup.ready}
              className="btn-primary btn-primary-sm disabled:opacity-40"
            >
              <Upload size={17} />
              Store file
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((file) => (
            <VaultFileCard key={file.id.toString()} file={file} onDeleted={refetch} />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); refetch() }}
        />
      )}
    </>
  )
}

export default function Vault() {
  if (isDemoMode) return <DemoVaultPage />
  return <LiveVaultPage />
}
