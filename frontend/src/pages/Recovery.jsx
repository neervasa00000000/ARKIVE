import { useState } from 'react'
import { Copy, Check, ExternalLink, Shield, Database, Lock, Globe } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'

const ARKIVE_APP_ARWEAVE_TX = import.meta.env.VITE_ARWEAVE_APP_TX || 'PENDING_DEPLOYMENT'
const RECOVERY_GUIDE_ARWEAVE_TX = import.meta.env.VITE_ARWEAVE_RECOVERY_TX || 'PENDING_DEPLOYMENT'

function CopyRow({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <span className="font-body text-text-secondary text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-text-primary text-xs ${mono ? 'font-mono' : 'font-body'} max-w-48 truncate`}>
          {value}
        </span>
        <button onClick={copy} className="text-text-muted hover:text-cyan-400 transition-colors flex-shrink-0">
          {copied ? <Check size={14} className="text-cyan-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

function Step({ number, title, description, code }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-elevated border border-border flex items-center justify-center font-mono text-xs text-text-secondary font-medium">
        {number}
      </div>
      <div className="flex-1 pb-6">
        <p className="font-display text-sm font-semibold text-text-primary mb-1">{title}</p>
        <p className="font-body text-text-secondary text-sm leading-relaxed mb-2">{description}</p>
        {code && (
          <div className="bg-card border border-border rounded-lg p-3 font-mono text-xs text-cyan-400 overflow-x-auto whitespace-pre-wrap break-all">
            {code}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Recovery() {
  return (
    <div className="max-w-2xl mx-auto">

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield size={24} className="text-cyan-400" />
          <h1 className="font-display text-2xl font-bold text-text-primary">Recovery Guide</h1>
        </div>
        <p className="font-body text-text-secondary leading-relaxed">
          Everything you need to access your data if ARKIVE disappears. Save this page. Print it. Bookmark the permanent Arweave URLs below. Your data is yours forever.
        </p>
      </div>

      <div className="bg-card border border-cyan-400/20 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-cyan-400" />
          <p className="font-display text-sm font-semibold text-text-primary">
            Permanent App URLs
          </p>
        </div>
        <p className="font-body text-text-secondary text-xs mb-4 leading-relaxed">
          These URLs work forever. If arkive.xyz disappears, use these directly. They load the full app from Arweave — no ARKIVE server involved.
        </p>

        <div className="space-y-1">
          <CopyRow
            label="App on Arweave"
            value={`https://arweave.net/${ARKIVE_APP_ARWEAVE_TX}`}
          />
          <CopyRow
            label="Recovery guide on Arweave"
            value={`https://arweave.net/${RECOVERY_GUIDE_ARWEAVE_TX}`}
          />
          <CopyRow
            label="App via ArNS"
            value="https://arkive.ar.io"
          />
        </div>

        {ARKIVE_APP_ARWEAVE_TX !== 'PENDING_DEPLOYMENT' && (
          <div className="flex gap-2 mt-4">
            <a
              href={`https://arweave.net/${ARKIVE_APP_ARWEAVE_TX}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-cyan-400/20 transition-colors"
            >
              <ExternalLink size={12} />
              Open permanent app
            </a>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-text-secondary" />
          <p className="font-display text-sm font-semibold text-text-primary">
            Contract Addresses (Base blockchain — permanent)
          </p>
        </div>
        <p className="font-body text-text-secondary text-xs mb-3 leading-relaxed">
          These smart contracts live on Base forever. Nobody can delete them. You can read your data directly from these addresses using basescan.org.
        </p>
        <CopyRow label="UserRegistry" value={CONTRACT_ADDRESSES.UserRegistry} />
        <CopyRow label="PostRegistry" value={CONTRACT_ADDRESSES.PostRegistry} />
        <CopyRow label="VaultRegistry" value={CONTRACT_ADDRESSES.VaultRegistry} />
        <CopyRow label="PointsSystem" value={CONTRACT_ADDRESSES.PointsSystem} />
        <CopyRow label="Network" value="Base Sepolia (chainId: 84532) — mainnet: 8453" mono={false} />

        {CONTRACT_ADDRESSES.PostRegistry !== '0x0000000000000000000000000000000000000000' && (
          <a
            href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESSES.PostRegistry}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-text-muted hover:text-cyan-400 transition-colors text-xs mt-4"
          >
            <ExternalLink size={12} />
            View PostRegistry on Basescan
          </a>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <p className="font-display text-sm font-semibold text-text-primary mb-5">
          Recovering Your Feed Posts
        </p>
        <div>
          <Step
            number="1"
            title="Open the permanent app"
            description="Go to the Arweave URL above. The full app loads without any ARKIVE server."
          />
          <Step
            number="2"
            title="Connect your wallet"
            description="Use MetaMask or any wallet on Base network. Your wallet address IS your identity."
          />
          <Step
            number="3"
            title="Your posts load automatically"
            description="The app reads PostRegistry smart contract and fetches each post from Arweave. Nothing is stored on any server."
          />
          <Step
            number="4"
            title="Manual reading (no app needed)"
            description="Go to basescan.org. Search the PostRegistry address. Call getUserPostIds([your-wallet]). For each post ID call getPost(id) to get the Arweave transaction ID. Go to arweave.net/[id] to read the content directly."
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={16} className="text-purple-400" />
          <p className="font-display text-sm font-semibold text-text-primary">
            Recovering Your Vault Files
          </p>
        </div>
        <div>
          <Step
            number="1"
            title="Open the permanent app on Arweave"
            description="Go to the permanent Arweave URL above. Full app works without ARKIVE."
          />
          <Step
            number="2"
            title="Connect the correct wallet"
            description="Must be the same wallet that encrypted the files. A different wallet cannot decrypt them."
          />
          <Step
            number="3"
            title="Navigate to Vault page"
            description="Your file list loads from VaultRegistry smart contract. Each file shows as a locked card."
          />
          <Step
            number="4"
            title="Click any file and sign to decrypt"
            description="The app first tries Lit Protocol. If Lit is unavailable, it automatically uses wallet signature fallback. Both paths are built into every file."
          />
          <Step
            number="5"
            title="If both automatic paths fail — manual recovery"
            description="Open browser console (F12). Run these commands one by one:"
            code={`// Step A: Fetch your encrypted payload from Arweave
const r = await fetch('https://arweave.net/[YOUR-ARWEAVE-TX-ID]')
const payload = await r.json()

// Step B: Sign the derivation message with MetaMask
const sig = await ethereum.request({
  method: 'personal_sign',
  params: [
    'ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT',
    '[YOUR-WALLET-ADDRESS]'
  ]
})

// Step C: Hash the signature to get your AES key (use keccak256 via viem/ethers)
// Step D–G: AES-GCM decrypt walletEncryptedAesKey, then encryptedFile
// See full commands in the Recovery page UI or arweave recovery guide TX`}
          />
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-display text-sm font-semibold text-amber-300 mb-2">
              Your Seed Phrase Is Your Master Key
            </p>
            <p className="font-body text-amber-300/80 text-sm leading-relaxed">
              12 words. Written on paper. Stored somewhere safe. That is the only thing in the world that can access your ARKIVE data. No seed phrase = no recovery. No exceptions. This is absolute ownership — no company can help you if it is lost.
            </p>
            <p className="font-body text-amber-300/80 text-sm leading-relaxed mt-2">
              Back it up now. Multiple copies. Different locations.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="font-display text-sm font-semibold text-text-primary mb-4">
          What Each Failure Means For Your Data
        </p>
        <div className="space-y-3">
          {[
            { scenario: 'ARKIVE website goes down', feed: true, vault: true, note: 'Use Arweave URL above' },
            { scenario: 'ARKIVE company dissolved', feed: true, vault: true, note: 'Contracts and Arweave still running' },
            { scenario: 'Lit Protocol goes down', feed: true, vault: true, note: 'Wallet fallback path works' },
            { scenario: 'Arweave gateway down', feed: true, vault: true, note: 'Use alt gateway: g8way.io, gateway.irys.xyz' },
            { scenario: 'Base network down', feed: true, vault: true, note: 'Temporary — Base will restart' },
            { scenario: 'Seed phrase lost', feed: false, vault: false, note: 'No recovery possible — ever' },
          ].map(({ scenario, feed, vault, note }) => (
            <div key={scenario} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
              <div>
                <p className="font-body text-text-primary text-xs">{scenario}</p>
                <p className="font-mono text-text-muted text-xs">{note}</p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <div className="text-center">
                  <p className="font-mono text-xs text-text-muted mb-0.5">Feed</p>
                  <span className={`font-mono text-xs font-bold ${feed ? 'text-cyan-400' : 'text-red-400'}`}>
                    {feed ? '✓' : '✗'}
                  </span>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs text-text-muted mb-0.5">Vault</p>
                  <span className={`font-mono text-xs font-bold ${vault ? 'text-purple-400' : 'text-red-400'}`}>
                    {vault ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
