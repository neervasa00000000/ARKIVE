import { usePoints } from '../hooks/usePoints'

export default function PointsBadge() {
  const { balance } = usePoints()

  return (
    <div className="hidden sm:flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
      <span className="font-mono text-xs text-cyan-400 font-medium">
        {balance.toLocaleString()} pts
      </span>
    </div>
  )
}
