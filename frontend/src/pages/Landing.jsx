import WalletButton from '../components/WalletButton'
import Logo from '../components/Logo'
import { isDemoMode } from '../config/demo'
import { Lock, Globe, Shield } from 'lucide-react'

const features = [
  {
    icon: Globe,
    title: 'Permanent',
    desc: 'Every byte lives on Arweave. No server can delete it.',
  },
  {
    icon: Shield,
    title: 'Encrypted',
    desc: 'Sealed on your device before it ever leaves your browser.',
  },
  {
    icon: Lock,
    title: 'Wallet-gated',
    desc: 'Only your signature opens the vault. Nobody else.',
  },
]

export default function Landing() {
  return (
    <div className="app-bg min-h-screen flex flex-col">
      <header className="px-6 sm:px-10 py-6 max-w-6xl mx-auto w-full">
        <Logo />
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-14 lg:gap-20 px-6 sm:px-10 pb-24 max-w-6xl mx-auto w-full">
        <div className="flex-1 text-center lg:text-left max-w-xl">
          <h1 className="font-display text-[2.75rem] sm:text-5xl lg:text-[3.5rem] font-semibold text-ink leading-[1.08] tracking-tight mb-6">
            Upload once.
            <br />
            <span className="text-muted">Keep forever.</span>
          </h1>

          <p className="text-muted text-lg sm:text-xl leading-relaxed mb-10 max-w-md mx-auto lg:mx-0">
            A wallet-gated vault on Arweave. Seal files, post to a permanent feed — only you hold the keys.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <WalletButton label={isDemoMode ? 'Try demo' : 'Connect wallet'} />
            <a href="#how" className="btn-ghost text-sm">
              How it works
            </a>
          </div>

          {isDemoMode && (
            <p className="mt-6 font-mono text-xs text-faint">
              Demo mode — set VITE_DEMO_MODE=false for on-chain
            </p>
          )}
        </div>

        <div id="how" className="flex-1 w-full max-w-md lg:max-w-lg">
          <div className="panel p-1">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className={`flex gap-4 p-5 rounded-2xl transition-colors ${
                  i < features.length - 1 ? 'border-b border-line' : ''
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-muted" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-display font-medium text-ink text-sm mb-1">{title}</p>
                  <p className="text-muted text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center lg:text-left text-faint text-xs font-mono mt-5">
            Base · Arweave · wallet-derived encryption
          </p>
        </div>
      </main>
    </div>
  )
}
