import { SidebarNav, MobileNav } from './NavBar'
import { AppWalletButton } from './DemoConnectButton'
import Logo from './Logo'
import { CircleDot, LockKeyhole, Box, Blocks } from 'lucide-react'
import { isDemoMode } from '../config/demo'

export default function Layout({ children }) {

  return (
    <div className="app-bg min-h-screen flex">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Desktop sidebar */}
      <aside className="app-sidebar hidden lg:flex flex-col fixed inset-y-0 left-0 z-40">
        <div className="sidebar-brand">
          <Logo />
          <span>Private permanence</span>
        </div>

        <div className="sidebar-nav-wrap">
          <p className="sidebar-section-label">Workspace</p>
          <SidebarNav />
        </div>

        <div className="sidebar-foot">
          <div className="network-card" aria-label="Environment status">
            <span className="network-card-icon"><CircleDot size={14} /></span>
            <span>
              <strong>{isDemoMode ? 'Demo workspace' : 'Base Sepolia'}</strong>
              <small>{isDemoMode ? 'No funds required' : 'Testnet connected'}</small>
            </span>
          </div>
          <div className="mobile-wallet"><AppWalletButton accountStatus="avatar" showBalance={false} /></div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main flex-1 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-5 py-4 border-b border-line bg-base/90 backdrop-blur-xl">
          <Logo size="sm" />
          <AppWalletButton accountStatus="avatar" showBalance={false} />
        </header>

        <div className="app-ledger hidden lg:flex" aria-label="Storage pipeline">
          <span><LockKeyhole size={13} /> Browser encrypted</span>
          <i />
          <span><Box size={13} /> Arweave stored</span>
          <i />
          <span><Blocks size={13} /> Base verified</span>
        </div>

        <main id="main-content" tabIndex="-1" className="app-content flex-1 w-full mx-auto px-5 sm:px-8 py-7 lg:py-10 pb-28 lg:pb-12">
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
