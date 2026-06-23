export function PermanentDot({ type = 'post' }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${
          type === 'vault' ? 'bg-purple-400' : 'bg-cyan-400'
        }`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${
          type === 'vault' ? 'bg-purple-500' : 'bg-cyan-400'
        }`} />
      </span>
      <span className="text-xs font-mono text-muted">
        {type === 'vault' ? 'encrypted forever' : 'stored forever'}
      </span>
    </div>
  )
}
