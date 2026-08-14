export default function PageHeader({ title, description, action }) {
  return (
    <header className="page-head flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
