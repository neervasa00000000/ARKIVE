import { TURBO_PAYMENT_HINT } from '../lib/turboUpload'

const COPY = {
  vault: {
    title: 'Wallet approvals',
    steps: [
      'Unlock your key, then approve storage and any ETH payment.',
      'Confirm the file record on Base Sepolia.',
    ],
  },
}

export function WalletUploadNotice({ context = 'vault' }) {
  if (context === 'post') return null

  const copy = COPY[context] || COPY.vault
  return (
    <div className="notice-inline text-xs text-text-muted space-y-1">
      <p className="font-body font-medium text-text-secondary">{copy.title}</p>
      <ol className="list-decimal list-inside space-y-0.5 font-body">
        {copy.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="font-body pt-1">{TURBO_PAYMENT_HINT}</p>
      <p className="font-body">
        Already paid? Wait 1–2 minutes, then retry using existing credits.
      </p>
    </div>
  )
}

export function VaultKeySignNotice() {
  return (
    <p className="font-body text-xs text-text-muted notice-inline">
      This signature unlocks your archive. Only sign on your trusted ARKIVE site.
    </p>
  )
}

export { TURBO_WALLET_LINK_MESSAGE } from '../lib/turboUpload'
