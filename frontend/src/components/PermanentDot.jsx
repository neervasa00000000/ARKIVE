import { isDemoMode } from '../config/demo'

export function PermanentDot({ type = 'post' }) {
  return (
    <span className="tag tag-live">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {isDemoMode ? 'Demo example' : type === 'vault' ? 'Encrypted' : 'On Arweave'}
    </span>
  )
}
