import NavBar from './NavBar'
import WalletButton from './WalletButton'
import PointsBadge from './PointsBadge'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-base flex flex-col">

      <nav className="sticky top-0 z-50 bg-base/90 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-display text-xl font-bold text-text-primary">
              ARK<span className="text-cyan-400">IVE</span>
            </span>
            <NavBar />
          </div>

          <div className="flex items-center gap-4">
            <PointsBadge />
            <WalletButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <NavBar variant="mobile" />
      </div>
    </div>
  )
}
