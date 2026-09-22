import { useEffect } from 'react'
import { Activity as ActivityIcon, Archive, CheckCircle2, ExternalLink, ShieldCheck, LockKeyhole, Blocks } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useDemoVault } from '../context/DemoVaultContext'
import { formatSealedDate } from '../demo/demoVault'
import { isDemoMode } from '../config/demo'

export default function Activity() {
  const { records, initVault } = useDemoVault()
  useEffect(() => { if (isDemoMode) initVault() }, [initVault])

  const events = isDemoMode
    ? records.map((record) => ({
        id: record.id,
        title: record.fileName,
        detail: 'Encrypted, stored, and registered',
        date: formatSealedDate(record.sealedAt),
        txId: record.arweaveTxId,
      }))
    : []

  return (
    <>
      <PageHeader eyebrow="Transaction log" title="Activity" description="Follow storage and registry operations from signature to confirmation." />

      <section className="activity-summary" aria-label="Network status">
        <div><ShieldCheck size={17} /><span><strong>Encryption</strong><small>Runs on your device</small></span></div>
        <div><Archive size={17} /><span><strong>Storage</strong><small>Arweave testnet path</small></span></div>
        <div><CheckCircle2 size={17} /><span><strong>Registry</strong><small>{isDemoMode ? 'Demo simulation' : 'Base Sepolia'}</small></span></div>
      </section>

      <section aria-labelledby="recent-activity-title" className="mt-8">
        <div className="section-heading-row">
          <h2 id="recent-activity-title">Recent operations</h2>
          <span>{events.length} records</span>
        </div>
        {events.length ? (
          <ol className="activity-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="activity-marker"><CheckCircle2 size={15} /></span>
                <span className="activity-event-copy min-w-0 flex-1">
                  <strong>{event.title}</strong>
                  <span className="operation-route" aria-label={event.detail}>
                    <span><LockKeyhole size={11} /> encrypted</span>
                    <i />
                    <span><Archive size={11} /> stored</span>
                    <i />
                    <span><Blocks size={11} /> registered</span>
                  </span>
                </span>
                <span className="activity-meta">
                  <time>{event.date}</time>
                  <span title={event.txId}>{event.txId.slice(0, 7)}...{event.txId.slice(-5)}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-inline">
            <ActivityIcon size={20} />
            <div><strong>No recent operations</strong><p>Your uploads and confirmations will appear here.</p></div>
          </div>
        )}
        {!isDemoMode && (
          <a className="text-link mt-5 inline-flex items-center gap-1.5" href="https://sepolia.basescan.org" target="_blank" rel="noreferrer">
            Open Base Sepolia explorer <ExternalLink size={14} />
          </a>
        )}
      </section>
    </>
  )
}
