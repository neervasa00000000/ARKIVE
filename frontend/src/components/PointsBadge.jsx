import { usePoints } from '../hooks/usePoints'

export default function PointsBadge() {
  const { balance } = usePoints()

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2 border border-line">
      <span className="text-[11px] text-faint uppercase tracking-wider">Points</span>
      <span className="font-mono text-sm text-ink font-medium">{balance.toLocaleString()}</span>
    </div>
  )
}
