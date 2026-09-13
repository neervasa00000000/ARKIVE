import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ArrowUpRight } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'

const backupLinks = [
  ['Open backup app', import.meta.env.VITE_ARWEAVE_APP_TX],
  ['Open backup guide', import.meta.env.VITE_ARWEAVE_RECOVERY_TX],
].filter(([, id]) => /^[A-Za-z0-9_-]{43}$/.test(id || ''))

function CopyRow({ label, value }) {
  const [status, setStatus] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('Copied')
    } catch {
      setStatus('Select the address to copy it.')
    }
  }
  return (
    <div className="py-3 border-b border-line last:border-0">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-muted text-xs">{label}</span>
        <button type="button" aria-label={`Copy ${label}`} onClick={copy} className="btn-ghost p-2">
          {status === 'Copied' ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <p className="font-mono text-xs text-muted break-all select-all">{value}</p>
      <span role="status" className="text-xs text-muted">{status}</span>
    </div>
  )
}

export default function RecoveryGuide({ embedded = false, showRecoveryLink = true }) {
  return (
    <div className={embedded ? '' : 'max-w-2xl mx-auto px-5 py-8'}>
      {!embedded && <h1 className="page-title mb-6">Recovery</h1>}
      <div className="panel p-5 sm:p-6">
        <h3 className="font-display text-sm font-semibold text-ink">Keep a backup you control</h3>
        <p className="text-muted text-sm leading-relaxed mt-2 max-w-lg">
          Save your .arkive copy and keep your recovery passphrase separately.
          You can also open files with a wallet authorised when they were stored.
        </p>
        {showRecoveryLink && (
          <Link to="/recover" className="btn-primary btn-primary-sm mt-5 inline-flex">
            Open an offline archive <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        )}
        <p className="text-muted text-xs leading-relaxed mt-4">
          Without an authorised wallet or recovery passphrase, encrypted files cannot be recovered.
        </p>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          Technical details
        </summary>
        <div className="mt-2 panel px-5 py-3">
          <p className="text-muted text-xs leading-relaxed py-2">Base Sepolia · Testnet. These addresses help locate registry records; they do not unlock files.</p>
          <CopyRow label="Vault registry" value={CONTRACT_ADDRESSES.VaultRegistry} />
          <CopyRow label="Public post registry" value={CONTRACT_ADDRESSES.PostRegistry} />
          {backupLinks.map(([label, id]) => (
            <a key={id} href={`https://arweave.net/${id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted py-3 underline">
              {label}<ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      </details>
    </div>
  )
}
