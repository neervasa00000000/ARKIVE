/** Neutral fallback: never show the landing page while a saved route/session is loading. */
export default function AppLoader() {
  return (
    <div className="app-bg min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <p className="text-sm text-muted">Loading ARKIVE…</p>
    </div>
  )
}
