import WalletButton from '../components/WalletButton'
import Logo from '../components/Logo'
import { isDemoMode } from '../config/demo'
import { Lock, Globe, Shield, Box, Blocks, LockKeyhole } from 'lucide-react'

const features = [
  {
    icon: Globe,
    title: 'Testnet storage',
    desc: 'Try encrypted storage with test files. Keep an independent backup.',
  },
  {
    icon: Shield,
    title: 'Encrypted',
    desc: 'Sealed on your device before it ever leaves your browser.',
  },
  {
    icon: Lock,
    title: 'Wallet-gated',
    desc: 'Open with an authorised wallet or a configured recovery passphrase.',
  },
]

export default function Landing() {
  return (
    <div className="landing-shell app-bg min-h-screen flex flex-col">
      <header className="landing-header px-6 sm:px-10 py-6 max-w-6xl mx-auto w-full">
        <Logo />
        <span className="landing-network"><i /> {isDemoMode ? 'Demo network' : 'Base Sepolia'}</span>
      </header>

      <main className="landing-main flex-1 px-6 sm:px-10 max-w-6xl mx-auto w-full">
        <div className="landing-scene" aria-hidden="true">
          <span className="scene-line scene-line-one" />
          <span className="scene-line scene-line-two" />
          <span className="scene-node scene-node-local"><LockKeyhole size={16} /></span>
          <span className="scene-node scene-node-store"><Box size={16} /></span>
          <span className="scene-node scene-node-chain"><Blocks size={16} /></span>
        </div>

        <div className="landing-copy text-center max-w-3xl mx-auto">
          <p className="landing-kicker">Encrypted permanence for what matters</p>
          <h1 className="font-display text-[2.75rem] sm:text-5xl lg:text-[4.4rem] font-semibold text-ink leading-[1.04] mb-6">
            Upload once.
            <br />
            <span>Keep what matters.</span>
          </h1>

          <p className="text-muted text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            An encrypted vault on testnet. Try it with test files and keep your originals. Long-term preservation is not yet available.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
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
          <div id="how" className="landing-trust-band">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="landing-trust-item"
              >
                <div className={`landing-trust-icon landing-trust-icon-${i + 1}`}>
                  <Icon size={17} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-display font-medium text-ink text-sm mb-1">{title}</p>
                  <p className="text-muted text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-faint text-xs font-mono mt-4">
            Base · Arweave · wallet-derived encryption
          </p>
        </div>
      </main>
    </div>
  )
}
