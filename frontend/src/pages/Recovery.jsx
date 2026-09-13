import RecoveryGuide from '../components/RecoveryGuide'
import OfflineRecovery from '../components/OfflineRecovery'

export default function Recovery() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="page-title mb-6">Recover your archive</h1>
      <OfflineRecovery />
      <RecoveryGuide embedded />
    </div>
  )
}
