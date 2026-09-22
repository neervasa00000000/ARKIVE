export default function Logo({ size = 'md' }) {
  const text = size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <span className={`brand-lockup ${text}`}>
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span className="font-display font-semibold text-ink">ARKIVE</span>
    </span>
  )
}
