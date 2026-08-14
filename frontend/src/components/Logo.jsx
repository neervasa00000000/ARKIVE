export default function Logo({ size = 'md' }) {
  const text = size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <span className={`font-display font-semibold tracking-tight text-ink ${text}`}>
      ARKIVE
    </span>
  )
}
