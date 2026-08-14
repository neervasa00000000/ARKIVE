export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="panel flex flex-col items-center justify-center text-center px-8 py-16">
      {Icon && (
        <div className="h-14 w-14 rounded-2xl bg-surface-2 border border-line flex items-center justify-center mb-5 text-faint">
          <Icon size={26} strokeWidth={1.5} />
        </div>
      )}
      <p className="font-display text-lg font-medium text-ink mb-2">{title}</p>
      {description && (
        <p className="text-muted text-sm max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
