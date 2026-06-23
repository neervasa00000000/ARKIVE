import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function WalletButton({ label, accountStatus, showBalance }) {
  return (
    <ConnectButton
      label={label}
      accountStatus={accountStatus}
      showBalance={showBalance}
    />
  )
}
