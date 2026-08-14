import { useDemoWallet } from '../context/DemoWalletContext'
import WalletButton from './WalletButton'

export default function DemoConnectButton({ label = 'Unlock' }) {
  const { connect } = useDemoWallet()
  return (
    <button type="button" onClick={() => connect()} className="btn-primary">
      {label}
    </button>
  )
}

export function AppWalletButton(props) {
  return <WalletButton {...props} />
}
