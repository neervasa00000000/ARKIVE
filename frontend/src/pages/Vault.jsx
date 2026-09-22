import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useWalletClient } from 'wagmi'
import { Upload, Lock, AlertTriangle, Search, ShieldCheck, Blocks, Infinity } from 'lucide-react'
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

function recordTimestamp(record) {
  if (record.sealedAt) return Number(record.sealedAt)
  if (record.storedAt) return Number(record.storedAt) * 1000
  return 0
}

function VaultWorkspace({ records, renderRecord, onStore, storeLabel, storeDisabled = false }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('newest')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...records]
      .filter((record) => !normalized || String(record.fileName || '').toLowerCase().includes(normalized))
      .filter((record) => type === 'all' || record.fileType === type)
      .sort((a, b) => sort === 'oldest' ? recordTimestamp(a) - recordTimestamp(b) : recordTimestamp(b) - recordTimestamp(a))
  }, [records, query, type, sort])

  return (
    <>
      <PageHeader
        title="Vault"
        eyebrow="Private archive"
        description="Encrypted in your browser. Verified onchain. Preserved on Arweave."
        action={(
          <button type="button" onClick={onStore} disabled={storeDisabled} className="btn-primary btn-primary-sm">
            <Upload size={17} /> {storeLabel}
          </button>
        )}
      />

      <section className="vault-signal" aria-label="Vault status">
        <div className="vault-signal-primary">
          <span className="signal-orbit" aria-hidden="true"><ShieldCheck size={19} /></span>
          <span><strong>{records.length} protected {records.length === 1 ? 'record' : 'records'}</strong><small>Only authorised wallets can decrypt</small></span>
        </div>
        <div className="vault-signal-item"><Blocks size={16} /><span><strong>Onchain proof</strong><small>Base Sepolia</small></span></div>
        <div className="vault-signal-item signal-permanent"><Infinity size={17} /><span><strong>Permanent storage</strong><small>Arweave anchored</small></span></div>
      </section>

      {records.length > 0 && (
        <section className="vault-toolbar" aria-label="Find and arrange records">
          <label className="search-field">
            <span className="sr-only">Search vault records</span>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" />
          </label>
          <label className="select-field">
            <span className="sr-only">Filter by file type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              <option value="document">Documents</option>
              <option value="image">Images</option>
              <option value="video">Video</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="select-field">
            <span className="sr-only">Sort records</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </section>
      )}

      {records.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="Vault is empty"
          description="Store a file to encrypt it on this device and create a verifiable storage record. Keep your original."
          action={<button type="button" onClick={onStore} disabled={storeDisabled} className="btn-primary btn-primary-sm"><Upload size={17} /> Store your first record</button>}
        />
      ) : filtered.length === 0 ? (
        <div className="empty-inline" role="status">
          <Search size={20} />
          <div><strong>No matching records</strong><p>Try another filename or choose a different file type.</p></div>
          <button type="button" onClick={() => { setQuery(''); setType('all') }} className="btn-ghost btn-compact">Clear filters</button>
        </div>
      ) : (
        <section aria-label="Vault records">
          <div className="section-heading-row"><h2>Records</h2><span aria-live="polite">{filtered.length} shown</span></div>
          <div className="record-list">
            {filtered.map((record) => renderRecord(record, 'list'))}
          </div>
        </section>
      )}
    </>
  )
}

function DemoVaultPage() {
  const { records, initVault, markOpened } = useDemoVault()
  const [showSeal, setShowSeal] = useState(false)

  useEffect(() => { initVault() }, [initVault])

  return (
    <>
      <VaultWorkspace
        records={records}
        onStore={() => setShowSeal(true)}
        storeLabel="Store record"
        renderRecord={(record, view) => <VaultRecordCard key={record.id} record={record} view={view} onOpened={(id) => markOpened(id)} />}
      />

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

      <VaultWorkspace
        records={files || []}
        onStore={() => setShowUpload(true)}
        storeLabel="Store file"
        storeDisabled={!setup.ready}
        renderRecord={(file, view) => <VaultFileCard key={file.id.toString()} file={file} view={view} onDeleted={refetch} />}
      />

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
