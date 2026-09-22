import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, ShieldCheck, Wallet } from 'lucide-react'
import { Modal, ModalBody, ModalHeader } from './Modal'
import { useVault } from '../hooks/useVault'
import { recoveryFailureCategory } from '../lib/recoveryTest'

const METHOD_LABELS = {
  passphrase: 'Passphrase',
  'owner-wallet': 'Owner wallet',
  'backup-wallet': 'Backup wallet',
}

export default function RecoveryTestModal({ record, onClose }) {
  const archiveId = record.encryptedArweaveId || record.arweaveTxId || record.arweaveId || record.archiveId
  const { inspectRecoveryMethods, testRecovery, loading, step } = useVault()
  const [inspection, setInspection] = useState(null)
  const [method, setMethod] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    inspectRecoveryMethods(archiveId)
      .then((next) => {
        if (!active) return
        setInspection(next)
        setMethod(next.methods[0] || '')
      })
      .catch((reason) => { if (active) setError(recoveryFailureCategory(reason)) })
    return () => { active = false }
  }, [archiveId])

  async function runTest(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    try {
      const evidence = await testRecovery(archiveId, { method, passphrase })
      setPassphrase('')
      setResult(evidence)
    } catch (reason) {
      setPassphrase('')
      setError(recoveryFailureCategory(reason))
    }
  }

  return (
    <Modal onClose={onClose} size="max-w-xl">
      <ModalHeader icon={ShieldCheck} title="Test recovery" description="Decrypt and verify this archive locally without changing or uploading it." onClose={onClose} />
      <ModalBody>
        {result ? (
          <div className="recovery-test-result" role="status">
            <span className="recovery-test-success"><CheckCircle2 size={24} /></span>
            <div><h3>Recovery test passed</h3><p>Exact original bytes verified</p></div>
            <dl>
              <div><dt>Method</dt><dd>{METHOD_LABELS[result.method]}</dd></div>
              <div><dt>Tested</dt><dd>{new Date(result.testedAt).toLocaleString()}</dd></div>
              <div><dt>Archive ID</dt><dd title={result.archiveId}>{result.archiveId.slice(0, 10)}...{result.archiveId.slice(-7)}</dd></div>
            </dl>
            <p className="recovery-test-note">Only verification evidence was saved. Recovered bytes and key material were cleared.</p>
          </div>
        ) : (
          <form onSubmit={runTest} className="space-y-4">
            {!inspection && !error && <p role="status" className="text-sm text-muted">Inspecting available recovery methods…</p>}
            {inspection && inspection.methods.length === 0 && <p className="notice-inline text-sm text-muted">No recovery method available for the connected wallet. This archive may require another wallet.</p>}
            {inspection?.methods.length > 0 && (
              <fieldset>
                <legend className="text-sm text-ink mb-2">Recovery method</legend>
                <div className="recovery-method-grid">
                  {inspection.methods.map((item) => (
                    <label key={item} className={`recovery-method-option ${method === item ? 'recovery-method-option-active' : ''}`}>
                      <input type="radio" name="recovery-method" value={item} checked={method === item} onChange={() => setMethod(item)} />
                      {item === 'passphrase' ? <KeyRound size={16} /> : <Wallet size={16} />}
                      <span>{METHOD_LABELS[item]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {method === 'passphrase' && (
              <label className="block text-sm text-ink">Recovery passphrase
                <input type="password" autoComplete="off" maxLength={1024} required value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="input-field mt-2" />
              </label>
            )}
            {step && <p role="status" className="font-mono text-xs text-muted">{step}</p>}
            {error && <div role="alert" className="notice-inline border-red-500/20 bg-red-500/5"><strong className="text-red-300 text-sm">Recovery test failed</strong><p className="text-muted text-xs mt-1">Reason: {error}</p></div>}
            <button type="submit" disabled={loading || !method || (method === 'passphrase' && !passphrase)} className="btn-primary w-full">{loading ? 'Verifying…' : 'Run recovery test'}</button>
            <p className="text-xs text-muted leading-relaxed">The test does not modify the archive or upload recovered plaintext.</p>
          </form>
        )}
      </ModalBody>
    </Modal>
  )
}
