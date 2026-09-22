import { useEffect, useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { clearRecoveryTestRecords, readRecoveryTestRecords, RECOVERY_TEST_EVENT } from '../lib/recoveryTest'

const labels = { passphrase: 'Passphrase', 'owner-wallet': 'Owner wallet', 'backup-wallet': 'Backup wallet' }

export default function RecoveryEvidencePanel() {
  const [records, setRecords] = useState(() => readRecoveryTestRecords())

  useEffect(() => {
    const refresh = () => setRecords(readRecoveryTestRecords())
    window.addEventListener(RECOVERY_TEST_EVENT, refresh)
    return () => window.removeEventListener(RECOVERY_TEST_EVENT, refresh)
  }, [])

  function clearHistory() {
    clearRecoveryTestRecords()
    setRecords([])
  }

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="recovery-evidence-title">
      <div className="flex items-start justify-between gap-4">
        <div><h3 id="recovery-evidence-title" className="font-display text-sm font-semibold text-ink">Recovery test history</h3><p className="text-muted text-xs mt-1">Non-secret verification evidence stored only in this browser.</p></div>
        {records.length > 0 && <button type="button" onClick={clearHistory} className="btn-ghost btn-compact"><Trash2 size={14} /> Clear</button>}
      </div>
      {records.length === 0 ? (
        <p className="recovery-evidence-empty">No successful recovery test recorded yet. Open an archive’s details to test it.</p>
      ) : (
        <ul className="recovery-evidence-list">
          {records.map((record) => (
            <li key={`${record.archiveId}:${record.testedAt}`}>
              <CheckCircle2 size={16} />
              <span><strong>{record.archiveId.slice(0, 9)}...{record.archiveId.slice(-6)}</strong><small>{labels[record.method]} · {new Date(record.testedAt).toLocaleString()}</small></span>
              <em>PASS</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
