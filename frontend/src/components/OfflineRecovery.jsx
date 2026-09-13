import { useEffect, useRef, useState } from 'react'
import { parseVaultBytes, MAX_VAULT_BUNDLE_BYTES } from '../lib/vaultBundle'
import { decryptVaultWithPassphrase } from '../lib/vaultCrypto'

export default function OfflineRecovery() {
  const [file, setFile] = useState(null)
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const objectUrl = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    }
  }, [])

  function clearResult() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
    setResult(null)
  }

  async function recover(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    clearResult()
    setBusy(true)
    try {
      if (!file || file.size === 0 || file.size > MAX_VAULT_BUNDLE_BYTES) throw new Error('INVALID_SIZE')
      const payload = parseVaultBytes(new Uint8Array(await file.arrayBuffer()))
      if (!payload.recoveryWrap) throw new Error('NO_RECOVERY_WRAP')
      const decrypted = await decryptVaultWithPassphrase(payload, passphrase)
      if (!mounted.current) return
      // Download as inert binary. Recovery never renders imported active content.
      const url = URL.createObjectURL(new Blob([decrypted.decryptedBytes], { type: 'application/octet-stream' }))
      objectUrl.current = url
      setResult({ url, fileName: decrypted.fileName })
    } catch (err) {
      if (mounted.current) setError(err.message === 'NO_RECOVERY_WRAP'
        ? 'This archive has no passphrase recovery key. Use an authorised wallet to open it.'
        : err.message === 'INVALID_SIZE'
          ? 'Choose a nonempty .arkive file smaller than 140 MB.'
          : 'Could not recover this archive. Check the passphrase and try an unmodified backup copy.')
    } finally {
      if (mounted.current) { setPassphrase(''); setBusy(false) }
    }
  }

  return (
    <section className="panel p-5 mb-6" aria-labelledby="offline-title">
      <h2 id="offline-title" className="font-display text-lg font-semibold mb-2">Open an offline archive</h2>
      <p className="text-muted text-sm mb-4">Choose your .arkive backup and the recovery passphrase you set when storing it. Decryption stays on this device.</p>
      <form onSubmit={recover} className="space-y-4" aria-busy={busy}>
        <div>
          <label htmlFor="offline-file" className="block text-sm mb-2">Archive file</label>
          <input id="offline-file" type="file" accept=".arkive" required disabled={busy} onChange={(event) => { clearResult(); setFile(event.target.files?.[0] || null); setError('') }} className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-ink" />
        </div>
        <div>
          <label htmlFor="offline-passphrase" className="block text-sm mb-2">Recovery passphrase</label>
          <input id="offline-passphrase" type="password" autoComplete="off" required maxLength={1024} disabled={busy} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="input-field w-full" aria-describedby={error ? 'offline-error' : undefined} />
        </div>
        {error && <p id="offline-error" role="alert" className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Decrypting…' : 'Decrypt archive'}</button>
        <div role="status" aria-live="polite">
          {result && <p className="text-sm">Archive authenticated and decrypted. <a className="underline" href={result.url} download={result.fileName}>Download {result.fileName}</a></p>}
        </div>
      </form>
    </section>
  )
}
