import { SidebarNav, MobileNav } from './NavBar'
import { AppWalletButton } from './DemoConnectButton'
import PointsBadge from './PointsBadge'
import Logo from './Logo'

export default function Layout({ children }) {

  return (
    <div className="app-bg min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] fixed inset-y-0 left-0 border-r border-line bg-base/80 backdrop-blur-xl z-40">
        <div className="px-5 pt-7 pb-6">
          <Logo />
        </div>

        <div className="px-3 flex-1">
          <SidebarNav />
        </div>

        <div className="p-4 border-t border-line space-y-3">
          <PointsBadge />
          <AppWalletButton accountStatus="avatar" showBalance={false} />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:pl-[240px] flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-5 py-4 border-b border-line bg-base/90 backdrop-blur-xl">
          <Logo size="sm" />
          <AppWalletButton accountStatus="avatar" showBalance={false} />
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-5 sm:px-8 py-8 lg:py-12 pb-28 lg:pb-12">
          <p className="notice-inline mb-5" role="note">Testnet beta. Use test files and keep your originals. Storage availability and long-term preservation are not guaranteed.</p>
          {children}
        </main>

        {/* Mobile bottom nav */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-base/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <MobileNav />
        </div>
      </div>
    </div>
  )
}
