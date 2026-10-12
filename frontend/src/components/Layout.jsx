import { SidebarNav, MobileNav } from './NavBar'
import { AppWalletButton } from './DemoConnectButton'
import Logo from './Logo'
import { ShieldCheck } from 'lucide-react'
import { isDemoMode } from '../config/demo'

export default function Layout({ children }) {
  return (
    <div className="workspace-shell min-h-screen">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <div className="workspace-brand"><Logo /><span>YOUR PERSONAL ARCHIVE</span></div>
          <div className="workspace-desktop-nav"><SidebarNav /></div>
          <div className="workspace-account">
            <span className="workspace-environment"><span />{isDemoMode ? 'Demo workspace' : 'Base Sepolia testnet'}</span>
            <AppWalletButton accountStatus="address" showBalance={false} />
          </div>
        </div>
      </header>

      <div className="workspace-context" aria-label="Storage status">
        <div className="workspace-context-inner"><ShieldCheck size={16} /><span>{isDemoMode ? 'Demo · sample content only.' : 'Testnet · use test files and keep originals.'}</span></div>
      </div>

      <main id="main-content" tabIndex="-1" className="workspace-content">
        {children}
      </main>
      <footer className="workspace-footer"><span>ARKIVE / PERSONAL ARCHIVE</span><span>{isDemoMode ? 'LOCAL DEMO' : 'BASE SEPOLIA'} <span aria-hidden="true">↗</span></span></footer>

      <div className="workspace-mobile-nav"><MobileNav /></div>
    </div>
  )
}
