const STEPS = [
  'Encrypting on your device',
  'Sealing to Arweave',
  'Writing to blockchain',
  'Done. Permanent.',
]

export default function SealProgress({ currentStep }) {
  return (
    <div className="space-y-3">
      {STEPS.map((label, i) => {
        const done = i < currentStep
        const active = i === currentStep
        const pending = i > currentStep

        return (
          <div
            key={label}
            className={`flex items-center gap-3 transition-all duration-500 ${
              pending ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full shrink-0 transition-all duration-500 ${
                done
                  ? 'bg-ink scale-100'
                  : active
                  ? 'bg-ink animate-pulse scale-110'
                  : 'bg-faint'
              }`}
            />
            <span
              className={`text-sm transition-colors duration-500 ${
                active || done ? 'text-ink' : 'text-faint'
              }`}
            >
              {label}
            </span>
            {active && (
              <div className="ml-auto h-3 w-3 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            )}
            {done && (
              <span className="ml-auto font-mono text-xs text-faint">✓</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
