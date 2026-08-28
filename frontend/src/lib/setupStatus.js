import { CONTRACT_ADDRESSES } from '../config/contracts'

const ZERO = '0x0000000000000000000000000000000000000000'

/**
 * @param {{ walletConnected?: boolean }} [opts]
 */
export function getSetupStatus(opts = {}) {
  const walletConnected = opts.walletConnected ?? false
  const contractsDeployed = CONTRACT_ADDRESSES.VaultRegistry !== ZERO

  return {
    contractsDeployed,
    walletConnected,
    ready: contractsDeployed && walletConnected,
    missing: [
      !contractsDeployed && 'Smart contracts not deployed to Base Sepolia',
      !walletConnected && 'Connect wallet — uploads are paid from your account via Turbo',
    ].filter(Boolean),
  }
}

function extractErrorText(error) {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  const nested = error.cause
  return (
    error.shortMessage ||
    error.details ||
    nested?.shortMessage ||
    nested?.message ||
    error.message ||
    String(error)
  )
}

/** User-facing message + optional technical detail for debugging */
export function vaultErrorMessage(error) {
  const code = extractErrorText(error)
  const lower = code.toLowerCase()
  const status = error?.status ?? error?.statusCode ?? error?.cause?.status

  const mapped = (() => {
    if (code === 'ARWEAVE_VERIFY_FAILED') {
      return 'Upload finished but the file is not on Arweave yet. Wait a minute and try sealing again.'
    }
    if (code === 'ARWEAVE_NOT_FOUND') {
      return 'This vault entry has no file on Arweave (old failed upload). Delete it and store the file again.'
    }
    if (code === 'ARWEAVE_FETCH_FAILED' || lower.includes('failed to fetch from arweave')) {
      return 'Could not load file from Arweave yet. Wait 1–2 minutes after upload and try again.'
    }
    if (code === 'ARWEAVE_FETCH_TIMEOUT') {
      return 'Arweave is slow right now. If you uploaded on this browser, try Sign & View again.'
    }
    if (lower === 'failed to fetch' || lower.includes('failed to fetch')) {
      return 'Could not reach Turbo/Arweave storage. Hard-refresh, disable ad blockers, approve MetaMask ETH if shown, then retry.'
    }
    if (code === 'WALLET_NOT_CONNECTED') {
      return 'Connect your wallet on Base Sepolia first.'
    }
    if (code === 'WRONG_NETWORK') {
      return 'Switch MetaMask to Base Sepolia (chain 84532).'
    }
    if (code === 'CONTRACTS_NOT_DEPLOYED') {
      return 'Smart contracts are not deployed. Deploy to Base Sepolia and rebuild.'
    }
    if (code === 'NOT_VAULT_OWNER') {
      return 'This file is sealed for a different wallet. Connect an authorised wallet or use a recovery passphrase.'
    }
    if (code === 'BACKUP_WALLET_NOT_CONNECTED') {
      return 'Switch MetaMask to the backup wallet address, then click Authorise.'
    }
    if (code === 'BACKUP_WALLET_NOT_AUTHORISED') {
      return 'Authorise the backup wallet before storing (switch to it, sign once, then switch back).'
    }
    if (code === 'BACKUP_WALLET_SAME_AS_OWNER') {
      return 'Backup wallet must be a different address from your main wallet.'
    }
    if (code === 'TOO_MANY_AUTHORISED_WALLETS') {
      return 'You can authorise up to 3 wallets total (main + 2 backups).'
    }
    if (code === 'CONTENT_HASH_MISMATCH') {
      return 'Archive integrity check failed. The ciphertext may be corrupted or tampered with.'
    }
    if (code === 'RECOVERY_PASSPHRASE_TOO_SHORT') {
      return 'Recovery passphrase must be at least 8 characters.'
    }
    if (code === 'NO_RECOVERY_WRAP') {
      return 'This file has no recovery passphrase. Connect an authorised wallet instead.'
    }
    if (code === 'NO_WALLET_KEY_WRAP') {
      return 'No key wrap for this wallet. Connect the owner or backup wallet used at seal time.'
    }
    if (code === 'INVALID_ARWEAVE_ID' || code === 'INVALID_VAULT_PAYLOAD') {
      return 'Invalid storage record.'
    }
    if (code === 'FILE_TOO_LARGE') {
      return 'File exceeds the 100 MB limit.'
    }
    if (code === 'FILE_TOO_LARGE_FOR_BROWSER') {
      return 'This file is too large for your browser memory. Try under 50 MB, or use a desktop browser.'
    }
    if (code === 'BROWSER_STORAGE_FULL') {
      return 'Browser storage is full. Clear site data for localhost or use a smaller file.'
    }
    if (code === 'INVALID_FILE' || code === 'FILE_NAME_TOO_LONG') {
      return 'Invalid file selected.'
    }
    if (code === 'FILE_TYPE_BLOCKED') {
      return 'This file type cannot be sealed.'
    }
    if (code === 'UNKNOWN_FILE_TYPE') {
      return 'Unknown file type. Use a standard extension (.pdf, .png, .txt, etc.) or set a correct MIME type.'
    }
    if (code === 'FILE_CONTENT_MISMATCH') {
      return 'File content does not match its type (possible disguised executable).'
    }
    if (lower.includes('user rejected') || lower.includes('denied')) {
      return 'You cancelled a step in MetaMask. Try again and approve all prompts.'
    }
    if (code === 'TURBO_WALLET_MISMATCH') {
      return 'Wallet mismatch for storage. Disconnect MetaMask, reconnect on Base Sepolia, retry.'
    }
    if (code === 'WALLET_SIGN_TIMEOUT') {
      return 'Open MetaMask (browser extension icon) and approve the pending Sign request — then try again if needed.'
    }
    if (code === 'TURBO_UPLOAD_TIMEOUT') {
      return 'Upload took too long. Open MetaMask for pending requests, then try again.'
    }
    if (code === 'TURBO_TOPUP_TIMEOUT' || code === 'TURBO_API_TIMEOUT') {
      return 'Storage service is slow. Wait a moment and try again.'
    }
    if (lower.includes('top up token amount') || lower.includes('maximum allowed amount')) {
      return 'Storage payment calculation error. Hard-refresh the page and try again.'
    }
    if (code === 'TX_RECEIPT_TIMEOUT') {
      return 'ETH payment is still pending. Wait 1 minute, then retry without paying again.'
    }
    if (code.startsWith('TURBO_CREDITS_TIMEOUT')) {
      return 'Payment went through but Turbo credits are still settling. Wait 1 minute and retry — you should not need to pay again.'
    }
    if (code.startsWith('TURBO_INSUFFICIENT_CREDITS')) {
      const detail = code.split(':').slice(1).join(':')
      return detail || 'Not enough Turbo credits. Approve the full ETH payment MetaMask shows for this file size.'
    }
    if (code.startsWith('TURBO_NETWORK_ERROR')) {
      const detail = code.split(':').slice(1).join(':')
      return detail || 'Could not reach Turbo storage. Hard-refresh and retry.'
    }
    if (code.startsWith('CHAIN_REGISTER_FAILED')) {
      const parts = code.split(':')
      const arweaveId = parts[1]
      const detail = parts.slice(3).join(':') || parts.slice(2).join(':')
      if (arweaveId?.length > 20) {
        return (
          detail ||
          `Step 2 failed — content is on Arweave (${arweaveId.slice(0, 8)}…) but not on the feed. Open MetaMask and approve the transaction (not a signature). Use Register on blockchain — storage will not be charged again.`
        )
      }
      return (
        detail ||
        'Step 2 failed — content is on Arweave but the blockchain transaction was not completed. Retry and approve the MetaMask transaction.'
      )
    }
    if (code.startsWith('TURBO_UPLOAD_AFTER_PAYMENT')) {
      return 'Uploading… If this persists, try again in a moment.'
    }
    if (code.startsWith('TURBO_FUND_PENDING')) {
      return 'Uploading… If this persists, try again in a moment.'
    }
    if (code.includes('TURBO_FUND_WRONG_TX')) {
      return 'Uploading… If this persists, try again in a moment.'
    }
    if (code.startsWith('TURBO_SMART_ACCOUNT_BLOCKED') || code.startsWith('TURBO_MISROUTE_BLOCKED')) {
      return 'Uploading… If this persists, try again in a moment.'
    }
    if (code.startsWith('SPONSOR_UPLOAD_FAILED')) {
      const detail = code.split(':').slice(1).join(':')
      if (detail === 'RATE_LIMIT' || detail === 'RATE_LIMIT_WALLET') {
        return 'Too many uploads right now. Wait a few minutes and try again.'
      }
      if (detail === 'SPONSOR_NOT_CONFIGURED') {
        return import.meta.env.DEV
          ? 'Sponsor server has no DEPLOYER_PRIVATE_KEY. Add it to contracts/.env and restart npm run dev.'
          : 'Sponsored upload is not available right now. Try again later.'
      }
      if (
        import.meta.env.DEV &&
        (detail === 'NETWORK_ERROR' ||
          detail.startsWith('SPONSOR_HTTP_5') ||
          detail === 'NOT_FOUND')
      ) {
        return 'Sponsor server unreachable. Restart dev: cd frontend && npm run dev'
      }
      if (detail === 'AUTH_INVALID' || detail === 'AUTH_EXPIRED') {
        return 'Sponsor auth failed. Open MetaMask and approve the sponsor signature, then retry.'
      }
      if (
        detail === 'SPONSOR_INIT_FAILED' ||
        detail.startsWith('SPONSOR_HTTP_5') ||
        detail === 'FUNCTION_INVOCATION_FAILED'
      ) {
        return 'Storage sponsor is temporarily down. Approve MetaMask prompts on the wallet-paid path, or retry in a minute.'
      }
      return import.meta.env.DEV
        ? `Sponsor upload failed (${detail || 'unknown'}). Check console [ARKIVE sponsor] and restart npm run dev.`
        : 'Upload failed. Try again in a moment.'
    }
    if (code.includes('Failed to submit fund transaction')) {
      return 'Turbo is still processing your ETH payment. Wait 1–2 minutes and try again — do not pay twice.'
    }
    if (code.startsWith('TURBO_UPLOAD_REJECTED')) {
      return 'Arweave storage service rejected the upload. Hard-refresh and retry; approve every MetaMask prompt.'
    }
    if (
      lower.includes('insufficient balance') ||
      lower.includes('underfunded') ||
      status === 402
    ) {
      return 'Storage credits too low. Approve the ETH payment MetaMask shows, then retry.'
    }
    if (
      lower.includes('insufficient funds') ||
      (lower.includes('insufficient') && lower.includes('gas'))
    ) {
      return 'Not enough Base Sepolia ETH for gas. Use a faucet and retry.'
    }
    if (lower.includes('failed to upload file') || lower.includes('failed request')) {
      return 'Arweave upload failed at the storage service. Hard-refresh, retry, approve all MetaMask steps.'
    }
    if (lower.includes('lit') || lower.includes('encrypt')) {
      return 'Encryption step failed. Try a smaller image.'
    }
    if (lower.includes('invalid address') || lower.includes('0x000')) {
      return 'Contract not configured. Deploy contracts and rebuild.'
    }
    return null
  })()

  if (mapped) return mapped

  // Show the real error when it is short enough — stops "random" opaque messages
  const cleaned = code.replace(/^Error:\s*/i, '').trim()
  if (cleaned.length > 0 && cleaned.length <= 160) {
    return cleaned
  }

  return 'Store failed. Open browser console (F12) and look for [ARKIVE Turbo] upload failed.'
}

export function vaultErrorDetail(error) {
  const code = extractErrorText(error)
  if (code.length > 80) return code.slice(0, 400)
  return null
}
