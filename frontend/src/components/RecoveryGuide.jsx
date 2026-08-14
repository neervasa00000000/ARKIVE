import { useState } from 'react'
import { Copy, Check, ExternalLink, Shield, Database, Lock, Globe, ChevronDown } from 'lucide-react'
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
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0 gap-3">
      <span className="text-muted text-xs shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-ink text-xs ${mono ? 'font-mono' : ''} truncate`}>
          {value}
        </span>
        <button type="button" onClick={copy} className="text-faint hover:text-ink transition-colors shrink-0">
          {copied ? <Check size={14} className="text-ink" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

function Step({ number, title, description, code }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-surface-2 border border-line flex items-center justify-center font-mono text-xs text-muted font-medium">
        {number}
      </div>
      <div className="flex-1 pb-5 last:pb-0">
        <p className="font-display text-sm font-semibold text-ink mb-1">{title}</p>
        <p className="text-muted text-sm leading-relaxed mb-2">{description}</p>
        {code && (
          <div className="bg-surface-2 border border-line rounded-xl p-3 font-mono text-xs text-ink/90 overflow-x-auto whitespace-pre-wrap break-all">
            {code}
          </div>
        )}
      </div>
    </div>
  )
}

function CollapsibleSection({ id, icon: Icon, title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div id={id} className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-surface-2/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3 min-w-0">
          {Icon && <Icon size={16} className="text-muted mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-ink">{title}</p>
            {description && (
              <p className="text-muted text-xs mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-5 pb-5 border-t border-line pt-4">{children}</div>}
    </div>
  )
}

const FAILURE_SCENARIOS = [
  { scenario: 'ARKIVE website goes down', feed: true, vault: true, note: 'Use Arweave URL above' },
  { scenario: 'ARKIVE company dissolved', feed: true, vault: true, note: 'Contracts and Arweave still running' },
  { scenario: 'Lit Protocol goes down', feed: true, vault: true, note: 'Wallet fallback path works' },
  { scenario: 'Arweave gateway down', feed: true, vault: true, note: 'Use alt gateway: g8way.io, gateway.irys.xyz' },
  { scenario: 'Base network down', feed: true, vault: true, note: 'Temporary — Base will restart' },
  { scenario: 'Seed phrase lost', feed: false, vault: false, note: 'No recovery possible — ever' },
]

const MANUAL_RECOVERY_CODE = `// Step A: Fetch encrypted payload from Arweave
const r = await fetch('https://arweave.net/[YOUR-ARWEAVE-TX-ID]')
const payload = await r.json()

// Step B (v2 — sealed after EIP-712 update): signTypedData with domain:
//   name: ARKIVE, version: 2, chainId: 84532, verifyingContract: VaultRegistry
//   message: { purpose: 'VAULT_KEY_DERIVATION', wallet: '[YOUR-WALLET]' }

// Step B (v1 legacy): personal_sign
//   'ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT'

// Step C: keccak256(signature) → AES-256-GCM key
// Step D–G: decrypt walletEncryptedAesKey, then encryptedFile`

export default function RecoveryGuide({ embedded = false }) {
  return (
    <div className={embedded ? '' : 'max-w-2xl mx-auto px-5 sm:px-8 py-12'}>
      {!embedded && (
        <div className="page-head mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center">
              <Shield size={18} className="text-muted" />
            </div>
            <h1 className="page-title">Recovery Guide</h1>
          </div>
          <p className="page-desc max-w-xl">
            Everything you need if ARKIVE disappears. Bookmark the Arweave URLs below — your data is yours forever.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <CollapsibleSection
          id="recovery-urls"
          icon={Globe}
          title="Permanent App URLs"
          description="Load the full app from Arweave — no ARKIVE server involved."
          defaultOpen
        >
          <div className="space-y-1">
            <CopyRow label="App on Arweave" value={`https://arweave.net/${ARKIVE_APP_ARWEAVE_TX}`} />
            <CopyRow
              label="Recovery guide on Arweave"
              value={`https://arweave.net/${RECOVERY_GUIDE_ARWEAVE_TX}`}
            />
            <CopyRow label="App via ArNS" value="https://arkive.ar.io" />
          </div>
          {ARKIVE_APP_ARWEAVE_TX !== 'PENDING_DEPLOYMENT' && (
            <a
              href={`https://arweave.net/${ARKIVE_APP_ARWEAVE_TX}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 btn-ghost px-3 py-1.5 text-xs mt-4"
            >
              <ExternalLink size={12} />
              Open permanent app
            </a>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="recovery-contracts"
          icon={Database}
          title="Contract Addresses (Base)"
          description="Permanent smart contracts on Base. Read your data directly via basescan.org."
        >
          <CopyRow label="WalletLinker" value={CONTRACT_ADDRESSES.WalletLinker} />
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
              className="inline-flex items-center gap-1.5 text-faint hover:text-ink transition-colors text-xs mt-4"
            >
              <ExternalLink size={12} />
              View PostRegistry on Basescan
            </a>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="recovery-feed"
          title="Recovering Your Feed Posts"
          description="Restore your feed from the permanent app or read contracts manually."
        >
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
        </CollapsibleSection>

        <CollapsibleSection
          id="recovery-vault"
          icon={Lock}
          title="Recovering Your Vault Files"
          description="Decrypt vault files via the app or manual console recovery."
        >
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
            code={MANUAL_RECOVERY_CODE}
          />
        </CollapsibleSection>

        <div className="callout callout-warn">
          <Shield size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-sm font-semibold text-amber-200 mb-1">
              Your seed phrase is your master key
            </p>
            <p className="text-sm leading-relaxed">
              12 words on paper, stored somewhere safe. That is the only thing that can access your ARKIVE data.
              No seed phrase = no recovery. Back it up now — multiple copies, different locations.
            </p>
          </div>
        </div>

        <CollapsibleSection
          id="recovery-failures"
          title="What Each Failure Means For Your Data"
          description="Quick reference for feed and vault availability by scenario."
        >
          <div className="space-y-3">
            {FAILURE_SCENARIOS.map(({ scenario, feed, vault, note }) => (
              <div
                key={scenario}
                className="flex items-center justify-between py-2 border-b border-line last:border-b-0 gap-4"
              >
                <div className="min-w-0">
                  <p className="text-ink text-xs">{scenario}</p>
                  <p className="font-mono text-faint text-xs truncate">{note}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <div className="text-center">
                    <p className="font-mono text-xs text-faint mb-0.5">Feed</p>
                    <span className={`font-mono text-xs font-bold ${feed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {feed ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-xs text-faint mb-0.5">Vault</p>
                    <span className={`font-mono text-xs font-bold ${vault ? 'text-emerald-400' : 'text-red-400'}`}>
                      {vault ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
