import WalletButton from '../components/WalletButton'
import { hasWalletConnectCloudId } from '../config/wagmi'

export default function Landing() {
  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6">

      <div className="mb-16 text-center">
        <h1 className="font-display text-6xl font-bold tracking-tight text-text-primary mb-2">
          ARK<span className="text-cyan-400">IVE</span>
        </h1>
        <p className="font-mono text-xs text-text-secondary tracking-widest uppercase">
          permanent. encrypted. yours.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full mb-16">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="font-display text-sm font-semibold text-cyan-400 uppercase tracking-wide">
              The Feed
            </span>
          </div>
          <p className="font-body text-text-secondary text-sm leading-relaxed">
            Post anything. Text or images. Stored permanently on Arweave and registered on the blockchain. Nobody can delete it. Not even us.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span className="font-display text-sm font-semibold text-purple-400 uppercase tracking-wide">
              The Vault
            </span>
          </div>
          <p className="font-body text-text-secondary text-sm leading-relaxed">
            Store private files encrypted with your wallet. Only your signature can decrypt them. Files survive even if this app disappears.
          </p>
        </div>
      </div>

      <WalletButton label="Connect wallet to enter" />

      {!hasWalletConnectCloudId && (
        <p className="mt-4 font-mono text-xs text-text-secondary text-center max-w-md">
          Browser extension wallets work now. For WalletConnect mobile wallets, add{' '}
          <code className="text-cyan-400">VITE_WALLETCONNECT_PROJECT_ID</code> to{' '}
          <code className="text-cyan-400">arkive/frontend/.env</code> from{' '}
          <a
            href="https://cloud.walletconnect.com"
            className="text-cyan-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            WalletConnect Cloud
          </a>
          .
        </p>
      )}

      <p className="mt-8 font-mono text-xs text-text-muted text-center max-w-sm">
        Testnet build on Base Sepolia. Your wallet is your identity. Your seed phrase is your key to everything you store here.
      </p>
    </div>
  )
}
