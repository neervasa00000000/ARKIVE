/**
 * User-paid Arweave uploads via Turbo SDK — Base Sepolia (`base-eth`).
 * Dev payment (Base Sepolia credits) + production upload (data actually lands on Arweave gateways).
 */
import {
  TurboFactory,
  ExistingBalanceFunding,
  defaultTurboConfiguration,
} from '@ardrive/turbo-sdk'
import { setCachedBytes, warmArweaveCacheInBackground } from './arweaveCache'
import { InjectedEthereumSigner, ArconnectSigner } from '@dha-team/arbundles'
import { arrayify } from '@ethersproject/bytes'
import { recoverPublicKey } from '@ethersproject/signing-key'
import { hashMessage as ethersHashMessage } from 'ethers'
import { waitForTransactionReceipt } from '@wagmi/core'
import { bytesToHex, createPublicClient, formatEther, http, isHex, parseEther, stringToHex } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { wagmiConfig } from '../config/wagmi'

const CHAIN_RPC = {
  [baseSepolia.id]: 'https://sepolia.base.org',
  [base.id]: 'https://mainnet.base.org',
}
/** Official Turbo base-eth destination — plain ETH transfers only */
const TURBO_BASE_ETH_WALLET = '0x9B13eb5096264B12532b8C648Eba4A662b4078ce'

const SUPPORTED_TURBO_CHAINS = {
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
}

function resolveWalletChain(walletClient) {
  const id = walletClient?.chain?.id
  return (id && SUPPORTED_TURBO_CHAINS[id]) || baseSepolia
}

function getTurboRpcUrl(chain) {
  return CHAIN_RPC[chain.id] || CHAIN_RPC[baseSepolia.id]
}

function getTurboPublicClient(chain) {
  return createPublicClient({
    chain,
    transport: http(getTurboRpcUrl(chain)),
  })
}

export const TURBO_WALLET_LINK_MESSAGE =
  'Authorize ARKIVE to upload files to permanent storage using your Base wallet. This is not a transaction — it links your wallet for small storage payments.'

export const TURBO_PAYMENT_HINT =
  'Approve MetaMask prompts (wallet link, ETH if file exceeds credits, storage signature). Storage signatures show encoded text in MetaMask — that is normal. Large files pay per size on Base.'

const ARCONNECT_PERMISSIONS = [
  'ACCESS_ADDRESS',
  'ACCESS_PUBLIC_KEY',
  'SIGNATURE',
  'SIGN_TRANSACTION',
]

const FUND_TX_STORAGE_PREFIX = 'arkive_turbo_fund_txs_'
const FEED_UPLOAD_PENDING_PREFIX = 'arkive_feed_upload_pending_'
const TURBO_PUBKEY_PREFIX = 'arkive_turbo_pubkey_'
const MISROUTE_STORAGE_PREFIX = 'arkive_turbo_misroute_'
/** Drop fund-tx markers older than this — prevents permanent upload blocks */
const FUND_TX_MAX_AGE_MS = 45 * 60 * 1000
const SIGN_TIMEOUT_MS = 90_000
/** Wait for MetaMask popup — extension can be slow; 12s caused false timeouts */
const METAMASK_PROMPT_TIMEOUT_MS = 60_000
const TURBO_API_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 90_000
const UPLOAD_TIMEOUT_FEED_MS = 60_000
const RECEIPT_TIMEOUT_MS = 45_000
const RECEIPT_TIMEOUT_FAST_MS = 30_000
const FUND_CREDIT_FAST_MS = 12_000
/** Feed: poll after ETH payment when credits are not yet visible */
const FUND_CREDIT_FEED_MS = 30_000
/** When fund txs are already pending, wait before failing — never charge twice */
const PENDING_FUND_REDEEM_MS = 30_000
const PENDING_FUND_REDEEM_FEED_MS = 30_000
/** Feed inline credit activation after ETH payment (images / large) */
const FEED_CREDIT_ACTIVATE_MS = 45_000
/** Poll after ETH payment before first upload attempt */
const FEED_CREDIT_POLL_AFTER_PAYMENT_MS = 45_000
/** Feed text <10KB — short poll after ETH payment; skip when credits already exist */
const FEED_CREDIT_TEXT_POLL_MS = 8_000
/** Recent ETH payment window — never throw TURBO_FUND_PENDING or charge again */
const RECENT_FEED_PAYMENT_MS = 5 * 60 * 1000
/** Feed fast path — drop stale fund markers after this (prevents permanent TURBO_FUND_PENDING blocks) */
const STALE_FUND_TX_FEED_MS = RECENT_FEED_PAYMENT_MS
/** Tiny feed text posts — any positive balance skips a new ETH payment */
const FEED_SMALL_POST_MAX_BYTES = 10 * 1024
const BALANCE_POLL_MS = 250
const BALANCE_POLL_FAST_MS = 200
const POST_RECEIPT_SETTLE_MS = 300
/** One session top-up covers many small feed posts */
const FEED_SESSION_TOPUP_BYTES = 512 * 1024
/** Feed image cap — must match security.js MAX_POST_IMAGE_BYTES */
const FEED_MAX_IMAGE_BYTES = 10 * 1024 * 1024
/** Turbo SDK minimum chunk size (see @ardrive/turbo-sdk chunked.js) */
const TURBO_MIN_CHUNK_BYTES = 5 * 1024 * 1024
/** Fast feed uploads: one sign + one POST — no SDK re-sign retries */
const FEED_UPLOAD_SDK_RETRIES = 1
/** After ETH payment, poll + retry upload on 402 before surfacing failure */
const POST_PAYMENT_UPLOAD_RETRIES = 3

/** Turbo client active during upload — used to credit ETH payments in sendTransaction */
let fundingTurboRef = null
/** Active upload may set this so cached Turbo clients still get sign prompts */
let uploadSignPromptHandler = null
let binarySignPromptConsumed = false

function setFundingTurbo(turbo) {
  fundingTurboRef = turbo
}

function setUploadSignPromptHandler(handler) {
  uploadSignPromptHandler = handler
}

function clearUploadSignPromptHandler() {
  uploadSignPromptHandler = null
}

function resetBinarySignPromptConsumed() {
  binarySignPromptConsumed = false
}

async function promptBeforeBinarySignIfNeeded(message, onSignPrompt) {
  if (typeof message === 'string') return
  const handler = onSignPrompt ?? uploadSignPromptHandler
  if (!handler || binarySignPromptConsumed) return
  binarySignPromptConsumed = true
  await handler({ kind: 'storage-upload' })
}

function clearFundingTurboRef() {
  fundingTurboRef = null
}

function extractTxHash(text) {
  if (!text) return null
  const match = String(text).match(/0x[a-fA-F0-9]{64}/)
  return match?.[0] ?? null
}

/** Reuse Turbo client per wallet session — avoids re-init on every upload */
let cachedTurboClient = null
let cachedTurboWallet = null
/** Short-lived balance hint — skip redundant Turbo API calls within a session */
let sessionBalanceHint = null
/** Feed modal prep — wallet link + credit check before submit */
let feedPrepCache = null

function cacheSessionBalance(walletAddress, winc) {
  sessionBalanceHint = {
    address: walletAddress.toLowerCase(),
    winc: String(winc || '0'),
    at: Date.now(),
  }
}

function clearFundTxs(walletAddress) {
  const key = FUND_TX_STORAGE_PREFIX + walletAddress.toLowerCase()
  try {
    localStorage?.removeItem(key)
    sessionStorage?.removeItem(key)
  } catch {}
}

/** Debug helper — clears stuck arkive_turbo_fund_txs_* markers for a wallet */
export function clearTurboFundState(walletAddress) {
  if (!walletAddress) return
  clearFundTxs(walletAddress)
}

async function getTurboBalanceCached(turbo, walletAddress) {
  const key = walletAddress.toLowerCase()
  if (
    sessionBalanceHint?.address === key &&
    Date.now() - sessionBalanceHint.at < 45_000
  ) {
    return { effectiveBalance: sessionBalanceHint.winc }
  }
  const balance = await withTurboTimeout(turbo.getBalance(walletAddress))
  cacheSessionBalance(walletAddress, balance.effectiveBalance)
  return balance
}

export function clearTurboClientCache() {
  cachedTurboClient = null
  cachedTurboWallet = null
  feedPrepCache = null
}

/**
 * Production Turbo payment + upload (payment.ardrive.dev is offline — do not use developmentTurboConfiguration).
 * Base Sepolia ETH credits still work via token `base-eth` + gatewayUrl below.
 */
const TURBO_CONFIG = defaultTurboConfiguration

if (import.meta.env.DEV) {
  TurboFactory.setLogLevel('debug')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise, ms, errorCode) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorCode)), ms)
    }),
  ])
}

function withTurboTimeout(promise, label = 'TURBO_API_TIMEOUT') {
  return withTimeout(promise, TURBO_API_TIMEOUT_MS, label)
}

function wincAtLeast(balanceWinc, neededWinc) {
  return BigInt(balanceWinc || '0') >= BigInt(neededWinc)
}

function hasAnyTurboCredits(balance) {
  return BigInt(balance?.effectiveBalance || '0') > 0n
}

function isSmallFeedPost(byteCount, fast) {
  return fast === true && byteCount < FEED_SMALL_POST_MAX_BYTES
}

function canSkipPaymentForSmallFeed(balance, byteCount, fast) {
  return isSmallFeedPost(byteCount, fast) && hasAnyTurboCredits(balance)
}

/** Small feed posts with any credits — never block on long fund-tx polls */

function maybeClearStaleFundTxs(walletAddress, balance, neededWinc, byteCount, fast) {
  if (
    wincAtLeast(balance?.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, fast)
  ) {
    clearFundTxs(walletAddress)
  }
}

function feedCreditPollMs(byteCount, fast, balance, neededWinc) {
  if (canSkipPaymentForSmallFeed(balance, byteCount, fast)) return 0
  if (isSmallFeedPost(byteCount, fast)) return FEED_CREDIT_TEXT_POLL_MS
  return FEED_CREDIT_ACTIVATE_MS
}

function logTiming(phase, startedAt) {
  console.info('[ARKIVE timing]', phase, Math.round(performance.now() - startedAt))
}

function logTurboPhase(phase, startedAt, extra = {}) {
  logTiming(phase, startedAt)
  if (import.meta.env.DEV && Object.keys(extra).length > 0) {
    console.debug(`[ARKIVE Turbo] ${phase}`, extra)
  }
}

function logPostPaymentPhase(phase, startedAt, extra = {}) {
  logTiming(`post-payment:${phase}`, startedAt)
  console.info(`[ARKIVE Turbo] post-payment ${phase}`, extra)
}

function getRecentFundTxEntries(walletAddress) {
  const now = Date.now()
  return readFundTxEntries(walletAddress).filter((e) => now - e.at < RECENT_FEED_PAYMENT_MS)
}

function hasRecentFeedPayment(walletAddress) {
  return getRecentFundTxEntries(walletAddress).length > 0
}

function submitAllFundTxs(turbo, walletAddress) {
  for (const entry of getRecentFundTxEntries(walletAddress)) {
    turbo.submitFundTransaction({ txId: entry.txId }).catch(() => {})
  }
  for (const txId of getStoredFundTxs(walletAddress)) {
    turbo.submitFundTransaction({ txId }).catch(() => {})
  }
}

function saveFeedUploadPending(walletAddress, payload) {
  const key = FEED_UPLOAD_PENDING_PREFIX + walletAddress.toLowerCase()
  try {
    localStorage?.setItem(key, JSON.stringify({ ...payload, at: Date.now() }))
  } catch {
    sessionStorage?.setItem(key, JSON.stringify({ ...payload, at: Date.now() }))
  }
}

export function getFeedUploadPending(walletAddress) {
  if (!walletAddress) return null
  const key = FEED_UPLOAD_PENDING_PREFIX + walletAddress.toLowerCase()
  try {
    const raw = localStorage?.getItem(key) || sessionStorage?.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - (parsed.at || 0) > RECENT_FEED_PAYMENT_MS) {
      clearFeedUploadPending(walletAddress)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearFeedUploadPending(walletAddress) {
  if (!walletAddress) return
  const key = FEED_UPLOAD_PENDING_PREFIX + walletAddress.toLowerCase()
  try {
    localStorage?.removeItem(key)
    sessionStorage?.removeItem(key)
  } catch {}
}

function feedUploadAfterPaymentError(txId, detail) {
  return `TURBO_UPLOAD_AFTER_PAYMENT:${txId || 'unknown'}:${detail || 'Payment received — click Retry upload. Storage will not be charged again.'}`
}

export function estimateBundleByteCount(fileSize) {
  return Math.ceil(fileSize * 1.05) + 2048
}

/** Funding / credit checks — bundle overhead when caller did not pass byteCount */
function resolveFundingByteCount(bytesLength, opts = {}) {
  if (opts.byteCount != null && opts.byteCount > 0) {
    return opts.byteCount
  }
  return estimateBundleByteCount(bytesLength)
}

function isUploadCreditFailure(error) {
  const msg = error?.shortMessage || error?.message || String(error)
  const status = error?.status ?? error?.statusCode
  return (
    status === 402 ||
    msg.toLowerCase().includes('insufficient') ||
    msg.includes('Failed request')
  )
}

/** Feed-only — user-paid path failed; app sponsor may cover storage (user still signs createPost). */
export function isSponsorEligibleFailure(error) {
  const msg = error?.shortMessage || error?.message || String(error)
  const lower = msg.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied')) return false
  if (msg === 'WALLET_NOT_CONNECTED') return false
  if (msg.startsWith('SPONSOR_UPLOAD_FAILED')) return false
  // Broad fallback: any other feed upload failure tries sponsor (smart accounts, proxy, credits, etc.)
  return true
}

/** Small feed text only — images must have full winc coverage; never pay ETH on partial credits */
function canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast) {
  return fast === true && isSmallFeedPost(byteCount, fast) && hasAnyTurboCredits(balance)
}

/** True when existing Turbo balance covers this upload — skip sendTransaction entirely */
export function creditsCoverUpload(balance, neededWinc, byteCount, fast) {
  return (
    wincAtLeast(balance?.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, fast)
  )
}

function rememberMisroute(walletAddress, txHash, reason) {
  if (!walletAddress) return
  const key = MISROUTE_STORAGE_PREFIX + walletAddress.toLowerCase()
  const entry = { txHash, reason, at: Date.now() }
  try {
    localStorage?.setItem(key, JSON.stringify(entry))
  } catch {
    sessionStorage?.setItem(key, JSON.stringify(entry))
  }
}

export function getRecentMisroute(walletAddress) {
  if (!walletAddress) return null
  const key = MISROUTE_STORAGE_PREFIX + walletAddress.toLowerCase()
  try {
    const raw = localStorage?.getItem(key) || sessionStorage?.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - (parsed.at || 0) > RECENT_FEED_PAYMENT_MS) {
      try {
        localStorage?.removeItem(key)
        sessionStorage?.removeItem(key)
      } catch {}
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function detectLikelySmartAccount(walletAddress, chain = baseSepolia) {
  try {
    const client = getTurboPublicClient(chain)
    const code = await client.getBytecode({ address: walletAddress })
    if (!code || code === '0x') return { likely: false }
    const normalized = code.toLowerCase()
    if (normalized.startsWith('0xef0100')) {
      return { likely: true, reason: 'eip-7702-delegation' }
    }
    return { likely: true, reason: 'contract-code-at-address' }
  } catch {
    return { likely: false }
  }
}

async function assertCanRequestEthPayment(
  _walletClient,
  _walletAddress,
  balance,
  neededWinc,
  byteCount,
  fast,
) {
  if (creditsCoverUpload(balance, neededWinc, byteCount, fast)) return
}

function isValidPreparedFunding(prepared) {
  return (
    prepared &&
    typeof prepared === 'object' &&
    prepared.fundingMode &&
    prepared.neededWinc != null &&
    prepared.balance?.effectiveBalance != null
  )
}

/** Guard opts.preparedFunding — invalid/stale prep objects are ignored instead of breaking upload */
export function normalizePreparedFunding(prepared) {
  if (!isValidPreparedFunding(prepared)) return null
  return {
    fundingMode: prepared.fundingMode,
    neededWinc: String(prepared.neededWinc),
    balance: { effectiveBalance: String(prepared.balance.effectiveBalance) },
    price: prepared.price ?? { tokenPrice: '0' },
  }
}

/** Feed fast path: if credits exist or fund txs are >5m old, clear blocking state and proceed */
function clearStaleFeedFundTxs(walletAddress, balance) {
  const entries = readFundTxEntries(walletAddress)
  if (entries.length === 0) return false

  if (hasAnyTurboCredits(balance)) {
    clearFundTxs(walletAddress)
    return true
  }

  const now = Date.now()
  if (entries.every((e) => now - e.at >= STALE_FUND_TX_FEED_MS)) {
    console.warn('[ARKIVE Turbo] clearing stale feed fund txs (>5m)')
    clearFundTxs(walletAddress)
    return true
  }
  return false
}

function normalizeFundTxEntry(entry) {
  if (typeof entry === 'string') return { txId: entry, at: Date.now() }
  if (entry?.txId) return { txId: entry.txId, at: entry.at || Date.now() }
  return null
}

function saveFundTxEntries(walletAddress, entries) {
  const key = FUND_TX_STORAGE_PREFIX + walletAddress.toLowerCase()
  const json = JSON.stringify(entries.slice(-10))
  try {
    localStorage?.setItem(key, json)
  } catch {
    sessionStorage?.setItem(key, json)
  }
}

function readFundTxEntries(walletAddress) {
  const key = FUND_TX_STORAGE_PREFIX + walletAddress.toLowerCase()
  const read = (storage) => {
    if (typeof storage === 'undefined') return null
    try {
      return JSON.parse(storage.getItem(key) || '[]')
    } catch {
      return null
    }
  }
  let raw = read(typeof localStorage !== 'undefined' ? localStorage : undefined)
  if (!raw?.length && typeof sessionStorage !== 'undefined') {
    raw = read(sessionStorage)
    if (raw?.length) {
      localStorage?.setItem(key, JSON.stringify(raw))
    }
  }
  return (raw || []).map(normalizeFundTxEntry).filter(Boolean)
}

function purgeStaleFundTxs(walletAddress, maxAgeMs = FUND_TX_MAX_AGE_MS) {
  const entries = readFundTxEntries(walletAddress)
  const now = Date.now()
  const fresh = entries.filter((e) => now - e.at < maxAgeMs)
  if (fresh.length !== entries.length) {
    if (fresh.length === 0) {
      clearFundTxs(walletAddress)
    } else {
      saveFundTxEntries(walletAddress, fresh)
    }
  }
  return fresh.map((e) => e.txId)
}

function removeFundTx(walletAddress, txHash) {
  if (!txHash) return
  const entries = readFundTxEntries(walletAddress).filter((e) => e.txId !== txHash)
  if (entries.length === 0) {
    clearFundTxs(walletAddress)
  } else {
    saveFundTxEntries(walletAddress, entries)
  }
}

function getStoredFundTxs(walletAddress) {
  return purgeStaleFundTxs(walletAddress)
}

function rememberFundTx(walletAddress, txHash) {
  if (!txHash) return
  const entries = readFundTxEntries(walletAddress).filter((e) => e.txId !== txHash)
  entries.push({ txId: txHash, at: Date.now() })
  saveFundTxEntries(walletAddress, entries)
}

export function hasPendingTurboPayment(walletAddress) {
  return getStoredFundTxs(walletAddress).length > 0
}

async function assertTurboPaymentRouted(txHash, chain, onStep, walletAddress) {
  const verify = await verifyDirectTurboPayment(txHash, chain)
  if (verify.ok) return verify
  if (walletAddress) {
    removeFundTx(walletAddress, txHash)
    rememberMisroute(walletAddress, txHash, verify.reason)
  }
  onStep?.('Storage payment could not be credited. Try again.')
  throw new Error('TURBO_FUND_WRONG_TX')
}

async function waitForPendingFundCredits(turbo, walletAddress, neededWinc, onStep, fast, byteCount = 0) {
  const pendingTxs = getStoredFundTxs(walletAddress)
  if (pendingTxs.length === 0) return null

  const balanceNow = await getTurboBalanceCached(turbo, walletAddress)
  if (
    wincAtLeast(balanceNow.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balanceNow, byteCount, fast)
  ) {
    maybeClearStaleFundTxs(walletAddress, balanceNow, neededWinc, byteCount, fast)
    return balanceNow
  }

  const waitMs = fast ? PENDING_FUND_REDEEM_FEED_MS : PENDING_FUND_REDEEM_MS
  onStep?.('Applying previous storage payment…')
  const balance = await redeemPendingCreditsQuick(
    turbo,
    walletAddress,
    neededWinc,
    waitMs,
    onStep,
    fast,
    byteCount,
  )
  if (
    wincAtLeast(balance.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, fast)
  ) {
    clearFundTxs(walletAddress)
    return balance
  }
  if (fast && canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast)) {
    clearFundTxs(walletAddress)
    return balance
  }
  return balance
}

function toUploadBytes(data) {
  if (data instanceof File || data instanceof Blob) {
    throw new Error('Pass ArrayBuffer or Uint8Array — read File before calling upload')
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data)
  }
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

function toRawBytes(message) {
  if (message instanceof Uint8Array) return message
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(message)) {
    return Uint8Array.from(message)
  }
  return new Uint8Array(message)
}

/** InjectedEthereumSigner expects a 0x-prefixed hex signature string. */
function normalizeSignature(sig) {
  if (!sig || typeof sig !== 'string') {
    throw new Error('WALLET_BAD_SIGNATURE')
  }
  if (isHex(sig)) return sig
  if (/^[0-9a-fA-F]{130}$/.test(sig)) return `0x${sig}`
  throw new Error('WALLET_BAD_SIGNATURE')
}

function messageToPersonalSignHex(message) {
  if (typeof message === 'string') return stringToHex(message)
  return bytesToHex(toRawBytes(message))
}

function isUserRejectedSign(error) {
  const text = String(error?.message || error?.cause?.message || error || '').toLowerCase()
  return text.includes('user rejected') || text.includes('user denied') || text.includes('rejected the request')
}

/**
 * Match @dha-team/arbundles InjectedEthereumSigner + ethers Wallet.signMessage:
 * - strings → EIP-191 personal_sign
 * - bytes   → EIP-191 over raw bytes (NOT sign raw hash without prefix)
 *
 * MetaMask smart accounts often ignore viem walletClient.signMessage — fall back to personal_sign.
 */
async function signWithWalletClient(walletClient, message, onSignPrompt) {
  await promptBeforeBinarySignIfNeeded(message, onSignPrompt)
  const address = walletClient.account.address

  const signViaWalletClient = () => {
    const signPromise =
      typeof message === 'string'
        ? walletClient.signMessage({ account: address, message })
        : walletClient.signMessage({
            account: address,
            message: { raw: toRawBytes(message) },
          })
    return withTimeout(signPromise, METAMASK_PROMPT_TIMEOUT_MS, 'WALLET_SIGN_TIMEOUT')
  }

  const signViaEthereum = async (signerAddress) => {
    const provider = typeof window !== 'undefined' ? window.ethereum : null
    if (!provider?.request) throw new Error('WALLET_NOT_CONNECTED')
    const hex = messageToPersonalSignHex(message)
    const sig = await withTimeout(
      provider.request({
        method: 'personal_sign',
        params: [hex, signerAddress],
      }),
      METAMASK_PROMPT_TIMEOUT_MS,
      'WALLET_SIGN_TIMEOUT',
    )
    return sig
  }

  try {
    return normalizeSignature(await signViaWalletClient())
  } catch (firstError) {
    if (isUserRejectedSign(firstError)) throw firstError
    try {
      return normalizeSignature(await signViaEthereum(address))
    } catch (secondError) {
      if (isUserRejectedSign(secondError)) throw secondError
      const provider = typeof window !== 'undefined' ? window.ethereum : null
      const accounts = provider?.request
        ? await provider.request({ method: 'eth_accounts' }).catch(() => [])
        : []
      const owner = accounts?.[0]
      if (owner && owner.toLowerCase() !== address.toLowerCase()) {
        return normalizeSignature(await signViaEthereum(owner))
      }
      throw secondError
    }
  }
}

/** Load cached pubkey onto arbundles signer — avoids a second link signature on getNativeAddress */
function hydrateTurboPublicKey(turboSigner, walletAddress) {
  const injected = turboSigner?.signer
  if (!(injected instanceof InjectedEthereumSigner) || injected.publicKey) return
  const cached =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(TURBO_PUBKEY_PREFIX + walletAddress.toLowerCase())
      : null
  if (cached) {
    injected.publicKey = Buffer.from(arrayify(cached))
  }
}

/** One-time Turbo wallet link — run early so MetaMask prompts before upload, not mid-flow. */
export async function warmTurboWalletLink(walletClient, onStep, onSignPrompt) {
  const address = walletClient.account.address.toLowerCase()
  const cacheKey = TURBO_PUBKEY_PREFIX + address
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(cacheKey)) {
    return
  }
  onStep?.('Open MetaMask — approve the wallet link (one-time, not a transaction)')
  const signedMsg = await signWithWalletClient(walletClient, TURBO_WALLET_LINK_MESSAGE, onSignPrompt)
  const hash = ethersHashMessage(TURBO_WALLET_LINK_MESSAGE)
  const recoveredKey = recoverPublicKey(arrayify(hash), signedMsg)
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(cacheKey, recoveredKey)
  }
}

/** ETH wei for one file. */
async function computeFileTopUpWei(turbo, byteCount) {
  const price = await withTurboTimeout(turbo.getTokenPriceForBytes({ byteCount }))
  const ethAmount = Math.max(parseFloat(price.tokenPrice) * 1.35, 0.00000005)
  return parseEther(ethAmount.toFixed(9))
}

/** One small top-up that covers many feed posts — pay once, post many times. */
async function computeFeedSessionTopUpWei(turbo) {
  const price = await withTurboTimeout(
    turbo.getTokenPriceForBytes({ byteCount: FEED_SESSION_TOPUP_BYTES }),
  )
  const ethAmount = Math.max(parseFloat(price.tokenPrice) * 1.25, 0.0000001)
  return parseEther(ethAmount.toFixed(9))
}

/** Feed text uses session top-up; images and larger posts pay for actual byte count. */
async function computeFeedTopUpWei(turbo, byteCount, fast) {
  if (fast && isSmallFeedPost(byteCount, true)) {
    return computeFeedSessionTopUpWei(turbo)
  }
  return computeFileTopUpWei(turbo, byteCount)
}

function feedFundPendingError(txId, chain) {
  const hash = txId && txId !== 'unknown' ? txId : null
  const explorer =
    hash && chain?.blockExplorers?.default?.url
      ? `${chain.blockExplorers.default.url}/tx/${hash}`
      : null
  const txHint = hash
    ? explorer
      ? `Payment tx: ${explorer}`
      : `Payment tx: ${hash.slice(0, 10)}…${hash.slice(-8)}`
    : 'Payment tx unknown'
  return `Storage credits did not activate within 30 seconds. ${txHint} — contact support if this persists. You should not be charged again.`
}

/** Inline poll for feed uploads — never abort early with "post again in 30s". */
async function waitForFeedCreditsInline(
  turbo,
  walletAddress,
  neededWinc,
  onStep,
  maxMs = FEED_CREDIT_ACTIVATE_MS,
  byteCount = 0,
  fast = false,
) {
  const balance = await getTurboBalanceCached(turbo, walletAddress)
  if (
    wincAtLeast(balance.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, fast)
  ) {
    maybeClearStaleFundTxs(walletAddress, balance, neededWinc, byteCount, fast)
    onStep?.('Credits ready — uploading…')
    return balance
  }
  if (maxMs <= 0) return balance

  onStep?.(hasRecentFeedPayment(walletAddress) ? 'Payment sent — finishing upload…' : 'Activating storage credits…')
  submitAllFundTxs(turbo, walletAddress)
  return pollBalanceUntil(turbo, walletAddress, neededWinc, maxMs, onStep, true, byteCount)
}

async function pollBalanceUntil(
  turbo,
  walletAddress,
  neededWinc,
  maxMs,
  onStep,
  fast = false,
  byteCount = 0,
) {
  const deadline = Date.now() + maxMs
  let tick = 0
  while (Date.now() < deadline) {
    tick++
    const balance = await getTurboBalanceCached(turbo, walletAddress)
    if (
      wincAtLeast(balance.effectiveBalance, neededWinc) ||
      canSkipPaymentForSmallFeed(balance, byteCount, fast)
    ) {
      onStep?.('Credits ready — uploading…')
      return balance
    }
    if (tick === 1) onStep?.('Activating storage credits…')
    await sleep(fast ? BALANCE_POLL_FAST_MS : BALANCE_POLL_MS)
  }
  return getTurboBalanceCached(turbo, walletAddress)
}

async function redeemPendingCreditsQuick(turbo, walletAddress, neededWinc, maxMs, onStep, fast = false, byteCount = 0) {
  submitAllFundTxs(turbo, walletAddress)
  return pollBalanceUntil(turbo, walletAddress, neededWinc, maxMs, onStep, fast, byteCount)
}

/** After ETH payment — submit fund tx and poll up to 45s; returns latest balance (may still be low). */
async function redeemRecentFeedPayment(turbo, walletAddress, neededWinc, onStep, byteCount, fast) {
  const started = performance.now()
  const recent = getRecentFundTxEntries(walletAddress)
  if (recent.length === 0) return getTurboBalanceCached(turbo, walletAddress)

  logPostPaymentPhase('redeem-start', started, {
    txs: recent.map((e) => e.txId),
    neededWinc,
  })
  onStep?.('Payment sent — finishing upload…')
  submitAllFundTxs(turbo, walletAddress)
  const balance = await pollBalanceUntil(
    turbo,
    walletAddress,
    neededWinc,
    FEED_CREDIT_POLL_AFTER_PAYMENT_MS,
    onStep,
    true,
    byteCount,
  )
  logPostPaymentPhase('redeem-done', started, {
    effectiveBalance: balance.effectiveBalance,
    neededWinc,
    credited: wincAtLeast(balance.effectiveBalance, neededWinc),
  })
  return balance
}

function shouldProceedToUploadAfterPayment(balance, neededWinc, byteCount, fast) {
  return (
    wincAtLeast(balance?.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, fast) ||
    canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast)
  )
}

/** One payment path — direct ETH to Turbo, then upload with credits. Never charges twice while fund txs are pending. */
async function payForUploadCredits(turbo, walletClient, walletAddress, byteCount, onStep, opts = {}) {
  const fast = opts.fast === true
  const creditWaitMs = fast ? FUND_CREDIT_FEED_MS : FUND_CREDIT_FAST_MS
  const neededWinc = await computeUploadWinc(turbo, byteCount)
  const chain = resolveWalletChain(walletClient)

  if (!fast) {
    await tryRedeemStoredPaymentsQuick(turbo, walletAddress)
  }

  let balanceProbe = await getTurboBalanceCached(turbo, walletAddress)
  if (fast) {
    clearStaleFeedFundTxs(walletAddress, balanceProbe)
  }

  const pendingBefore = getStoredFundTxs(walletAddress)
  let balance = await waitForPendingFundCredits(turbo, walletAddress, neededWinc, onStep, fast, byteCount)
  if (balance && wincAtLeast(balance.effectiveBalance, neededWinc)) {
    return balance
  }
  if (balance && canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
    return balance
  }

  if (!balance) {
    balance = await getTurboBalanceCached(turbo, walletAddress)
  }
  maybeClearStaleFundTxs(walletAddress, balance, neededWinc, byteCount, fast)
  if (wincAtLeast(balance.effectiveBalance, neededWinc)) {
    return balance
  }
  if (canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
    return balance
  }
  if (fast && canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast)) {
    return balance
  }

  // Credits still pending from a prior ETH payment
  if (pendingBefore.length > 0 || getStoredFundTxs(walletAddress).length > 0) {
    const lastTx = getStoredFundTxs(walletAddress).at(-1) || pendingBefore.at(-1)
    if (lastTx) {
      await assertTurboPaymentRouted(lastTx, chain, onStep, walletAddress).catch((error) => {
        if (String(error?.message || '').startsWith('TURBO_FUND_WRONG_TX')) throw error
      })
    }
    if (fast) {
      balance = await waitForFeedCreditsInline(
        turbo,
        walletAddress,
        neededWinc,
        onStep,
        feedCreditPollMs(byteCount, fast, balance, neededWinc),
        byteCount,
        fast,
      )
      if (wincAtLeast(balance.effectiveBalance, neededWinc)) {
        clearFundTxs(walletAddress)
        return balance
      }
      if (canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
        return balance
      }
      if (canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast)) {
        console.warn('[ARKIVE Turbo] pending fund txs timed out — uploading with existing credits')
        clearFundTxs(walletAddress)
        return balance
      }
      if (hasRecentFeedPayment(walletAddress)) {
        balance = await redeemRecentFeedPayment(
          turbo,
          walletAddress,
          neededWinc,
          onStep,
          byteCount,
          fast,
        )
        onStep?.('Payment sent — finishing upload…')
        return balance
      }
      console.warn('[ARKIVE Turbo] clearing stale fund txs — allowing fresh storage payment')
      clearFundTxs(walletAddress)
    } else {
      balance = await redeemRecentFeedPayment(
        turbo,
        walletAddress,
        neededWinc,
        onStep,
        byteCount,
        fast,
      )
      onStep?.('Payment sent — finishing upload…')
      return balance
    }
  }

  if (opts.skipNewPayment) {
    balance = await redeemRecentFeedPayment(turbo, walletAddress, neededWinc, onStep, byteCount, fast)
    return balance
  }

  if (hasRecentFeedPayment(walletAddress)) {
    onStep?.('Payment sent — finishing upload…')
    balance = await redeemRecentFeedPayment(turbo, walletAddress, neededWinc, onStep, byteCount, fast)
    return balance
  }

  await assertCanRequestEthPayment(
    walletClient,
    walletAddress,
    balance,
    neededWinc,
    byteCount,
    fast,
  )

  const ethWei = await (fast
    ? computeFeedTopUpWei(turbo, byteCount, true)
    : computeFileTopUpWei(turbo, byteCount))
  const ethLabel = formatEther(ethWei)
  onStep?.(`Step 1 of 2 — approve ${ethLabel} ETH storage payment in MetaMask`)

  const chainLabel = chain.id === base.id ? 'Base' : 'Base Sepolia'

  const hash = await withTimeout(
    walletClient.sendTransaction({
      account: walletAddress,
      chain,
      to: TURBO_BASE_ETH_WALLET,
      value: ethWei,
    }),
    SIGN_TIMEOUT_MS,
    'WALLET_SIGN_TIMEOUT',
  )

  await assertTurboPaymentRouted(hash, chain, onStep, walletAddress)
  rememberFundTx(walletAddress, hash)
  turbo.submitFundTransaction({ txId: hash }).catch(() => {})
  onStep?.(fast ? 'Payment sent — finishing upload…' : `Payment confirming on ${chainLabel}…`)

  if (fast) {
    const postPayStart = performance.now()
    logPostPaymentPhase('payment-sent', postPayStart, { txId: hash })
    balance = await redeemRecentFeedPayment(
      turbo,
      walletAddress,
      neededWinc,
      onStep,
      byteCount,
      fast,
    )
    if (wincAtLeast(balance.effectiveBalance, neededWinc)) {
      clearFundTxs(walletAddress)
      logPostPaymentPhase('credits-ready', postPayStart, { txId: hash })
      return balance
    }
    if (canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
      logPostPaymentPhase('small-feed-credits', postPayStart, { txId: hash })
      return balance
    }
    await withTimeout(
      waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: chain.id,
        confirmations: 1,
        timeout: RECEIPT_TIMEOUT_FAST_MS,
      }),
      RECEIPT_TIMEOUT_FAST_MS + 5_000,
      'TX_RECEIPT_TIMEOUT',
    ).catch(() => {})
    turbo.submitFundTransaction({ txId: hash }).catch(() => {})
    balance = await waitForFeedCreditsInline(
      turbo,
      walletAddress,
      neededWinc,
      onStep,
      Math.min(15_000, FEED_CREDIT_POLL_AFTER_PAYMENT_MS),
      byteCount,
      fast,
    )
    if (wincAtLeast(balance.effectiveBalance, neededWinc)) {
      clearFundTxs(walletAddress)
      logPostPaymentPhase('credits-ready-after-receipt', postPayStart, { txId: hash })
      return balance
    }
    logPostPaymentPhase('proceed-upload-low-balance', postPayStart, {
      txId: hash,
      balance: balance.effectiveBalance,
      neededWinc,
    })
    onStep?.('Payment sent — finishing upload…')
    return balance
  }

  balance = await pollBalanceUntil(turbo, walletAddress, neededWinc, creditWaitMs, onStep, fast, byteCount)
  if (wincAtLeast(balance.effectiveBalance, neededWinc)) {
    clearFundTxs(walletAddress)
    return balance
  }

  await withTimeout(
    waitForTransactionReceipt(wagmiConfig, {
      hash,
      chainId: chain.id,
      confirmations: 1,
      timeout: fast ? RECEIPT_TIMEOUT_FAST_MS : RECEIPT_TIMEOUT_MS,
    }),
    (fast ? RECEIPT_TIMEOUT_FAST_MS : RECEIPT_TIMEOUT_MS) + 5_000,
    'TX_RECEIPT_TIMEOUT',
  ).catch(() => {})

  turbo.submitFundTransaction({ txId: hash }).catch(() => {})
  balance = await pollBalanceUntil(
    turbo,
    walletAddress,
    neededWinc,
    PENDING_FUND_REDEEM_MS,
    onStep,
    false,
    byteCount,
  )

  if (!wincAtLeast(balance.effectiveBalance, neededWinc)) {
    logPostPaymentPhase('proceed-upload-low-balance-nonfast', performance.now(), {
      txId: hash,
      balance: balance.effectiveBalance,
      neededWinc,
    })
    onStep?.('Payment sent — finishing upload…')
    return balance
  }
  clearFundTxs(walletAddress)
  return balance
}

async function creditTurboPayment(turbo, walletAddress, txHash, neededWinc, onStep) {
  rememberFundTx(walletAddress, txHash)
  turbo.submitFundTransaction({ txId: txHash }).catch(() => {})
  await sleep(POST_RECEIPT_SETTLE_MS)
  const credited = await waitForCreditsFast(turbo, walletAddress, txHash, neededWinc, onStep)
  if (credited) return true
  const balance = await getTurboBalanceCached(turbo, walletAddress)
  return wincAtLeast(balance.effectiveBalance, neededWinc)
}

function toWeiBigInt(value) {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(Math.trunc(value))
  return BigInt(value.toString())
}

/**
 * Single wallet adapter for Turbo SDK browser path.
 * Do NOT pass a separate `signer` — TurboFactory replaces it with InjectedEthereumSigner(adapter).
 */
function createEthereumWalletAdapter(walletClient, onStep, onSignPrompt) {
  const address = walletClient.account.address
  const chain = resolveWalletChain(walletClient)
  const chainLabel = chain.id === base.id ? 'Base' : 'Base Sepolia'
  return {
    getSigner: () => ({
      signMessage: (message) => {
        if (typeof message === 'string' && message === TURBO_WALLET_LINK_MESSAGE) {
          onStep?.('Check MetaMask — approve wallet link for permanent storage')
        } else if (typeof message === 'string' && message.includes('Bundlr')) {
          onStep?.('Check MetaMask — approve wallet link for permanent storage')
        } else if (typeof message !== 'string') {
          onStep?.('Check MetaMask — approve the storage signature (encoded text is normal)')
        } else {
          onStep?.('Check MetaMask — approve the storage signature')
        }
        return signWithWalletClient(walletClient, message, onSignPrompt)
      },
      sendTransaction: async ({ to, value, data }) => {
        const payWei = toWeiBigInt(value)
        const dest = to || TURBO_BASE_ETH_WALLET
        onStep?.('Step 1 of 2 — approve storage payment in MetaMask…')
        const hash = await withTimeout(
          walletClient.sendTransaction({
            account: address,
            chain,
            to: dest,
            value: payWei,
            data: data || undefined,
          }),
          SIGN_TIMEOUT_MS,
          'WALLET_SIGN_TIMEOUT',
        )
        onStep?.(`Payment confirming on ${chainLabel}…`)
        await withTimeout(
          waitForTransactionReceipt(wagmiConfig, {
            hash,
            chainId: chain.id,
            confirmations: 1,
            timeout: RECEIPT_TIMEOUT_MS,
          }),
          RECEIPT_TIMEOUT_MS + 10_000,
          'TX_RECEIPT_TIMEOUT',
        )
        await assertTurboPaymentRouted(hash, chain, onStep, address)
        rememberFundTx(address, hash)
        fundingTurboRef?.submitFundTransaction({ txId: hash }).catch(() => {})
        return { hash }
      },
    }),
  }
}

function patchTurboSignerPublicKey(turboSigner, walletClient, onStep, onSignPrompt) {
  const injected = turboSigner?.signer
  if (!(injected instanceof InjectedEthereumSigner)) return

  const address = walletClient.account.address.toLowerCase()
  hydrateTurboPublicKey(turboSigner, address)

  injected.setPublicKey = async () => {
    if (injected.publicKey) return
    if (typeof sessionStorage !== 'undefined') {
      const cached = sessionStorage.getItem(TURBO_PUBKEY_PREFIX + address)
      if (cached) {
        injected.publicKey = Buffer.from(arrayify(cached))
        return
      }
    }
    onStep?.('Check MetaMask — approve wallet link for permanent storage')
    const signedMsg = await signWithWalletClient(walletClient, TURBO_WALLET_LINK_MESSAGE, onSignPrompt)
    const hash = ethersHashMessage(TURBO_WALLET_LINK_MESSAGE)
    const recoveredKey = recoverPublicKey(arrayify(hash), signedMsg)
    injected.publicKey = Buffer.from(arrayify(recoveredKey))
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(TURBO_PUBKEY_PREFIX + address, recoveredKey)
    }
  }
}

/** Poll balance + submit fund tx — maxMs caps total wait (avoids multi-minute stalls). */
async function waitForCreditsFast(
  turbo,
  walletAddress,
  txId,
  neededWinc,
  onStep,
  maxMs = FUND_CREDIT_FAST_MS,
  byteCount = 0,
) {
  if (txId) turbo.submitFundTransaction({ txId }).catch(() => {})
  const balance = await pollBalanceUntil(
    turbo,
    walletAddress,
    neededWinc,
    maxMs,
    onStep,
    maxMs <= FUND_CREDIT_FEED_MS,
    byteCount,
  )
  return (
    wincAtLeast(balance.effectiveBalance, neededWinc) ||
    canSkipPaymentForSmallFeed(balance, byteCount, maxMs <= FUND_CREDIT_FEED_MS) ||
    (maxMs <= FUND_CREDIT_FEED_MS && hasAnyTurboCredits(balance))
  )
}

async function submitFundTxUntilCredited(turbo, txId, onStep, walletAddress, neededWinc) {
  if (!turbo || !txId) return false
  if (walletAddress && neededWinc) {
    return waitForCreditsFast(turbo, walletAddress, txId, neededWinc, onStep)
  }
  // Fallback: single submit + short poll
  try {
    const result = await turbo.submitFundTransaction({ txId })
    return result.status === 'confirmed'
  } catch {
    return false
  }
}

async function verifyDirectTurboPayment(txHash, chain = baseSepolia) {
  const client = getTurboPublicClient(chain)
  const tx = await client.getTransaction({ hash: txHash })
  const to = tx.to?.toLowerCase()
  const expected = TURBO_BASE_ETH_WALLET.toLowerCase()
  if (to !== expected || !tx.value || tx.value === 0n) {
    return {
      ok: false,
      reason: to !== expected ? 'wrong-recipient' : 'zero-value',
    }
  }
  return { ok: true, value: tx.value }
}

/** Winc required for this upload (file bytes + 20% margin). */
async function computeUploadWinc(turbo, byteCount) {
  const [{ winc: fileWinc }] = await turbo.getUploadCosts({ bytes: [byteCount] })
  return ((BigInt(fileWinc) * 12n) / 10n).toString()
}

/** @deprecated alias */
async function computeNeededWinc(turbo, byteCount) {
  return computeUploadWinc(turbo, byteCount)
}

async function tryRedeemStoredPaymentsQuick(turbo, walletAddress) {
  for (const txId of getStoredFundTxs(walletAddress)) {
    try {
      const result = await turbo.submitFundTransaction({ txId })
      if (result.status === 'confirmed') {
        console.info('[ARKIVE Turbo] redeemed pending fund tx', txId)
      }
    } catch (error) {
      console.debug('[ARKIVE Turbo] fund tx still pending', txId, error?.message || error)
    }
  }
}

async function recoverFailedFundSubmit(turbo, walletAddress, message, onStep, neededWinc) {
  const txId = extractTxHash(message) || getStoredFundTxs(walletAddress).at(-1)
  if (!txId) return false

  rememberFundTx(walletAddress, txId)
  onStep?.('Finishing payment credit…')
  return waitForCreditsFast(turbo, walletAddress, txId, neededWinc || '1', onStep)
}

export async function checkWalletCanPayTurbo(_walletAddress, _chain = baseSepolia) {
  return { ok: true }
}

export async function estimateUploadCost(walletClient, byteCount) {
  const address = walletClient.account.address
  const turbo = TurboFactory.unauthenticated({
    ...TURBO_CONFIG,
    token: 'base-eth',
  })
  const uploadBytes = estimateBundleByteCount(byteCount)
  const neededWinc = await computeNeededWinc(turbo, uploadBytes)
  const balance = await turbo.getBalance(address)
  const price = await turbo.getTokenPriceForBytes({ byteCount: uploadBytes })
  const hasCredits = wincAtLeast(balance.effectiveBalance, neededWinc)
  const ethWithBuffer = (parseFloat(price.tokenPrice) * 1.5).toFixed(6)
  const walletCheck = hasCredits
    ? { ok: true }
    : await checkWalletCanPayTurbo(address, resolveWalletChain(walletClient))
  return {
    byteCount: uploadBytes,
    sizeMb: uploadBytes / (1024 * 1024),
    ethEstimate: price.tokenPrice,
    ethWithBuffer,
    hasCredits,
    paysEth: !hasCredits,
    turboBalanceWinc: balance.effectiveBalance,
    neededWinc,
    walletAddress: address,
    walletCanPay: walletCheck.ok,
    walletPayWarning: walletCheck.message || null,
  }
}

/**
 * Resolve Turbo credits BEFORE encryption — avoids wasting time encrypting then failing on payment.
 * Call once per store; pass creditsReady on upload to skip duplicate prefund.
 */
export async function ensureStorageCreditsReady(walletClient, byteCount, onStep, opts = {}) {
  const walletAddress = walletClient.account.address
  await warmTurboWalletLink(walletClient, onStep)
  const { turbo } = await getTurboClient(walletClient, { onStep })
  setFundingTurbo(turbo)

  try {
    const turboAddress = await turbo.signer.getNativeAddress()
    if (turboAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('TURBO_WALLET_MISMATCH')
    }
    const prepared = await pickFundingMode(
      turbo,
      walletClient,
      walletAddress,
      byteCount,
      onStep,
      opts,
    )
    return { ready: true, preparedFunding: prepared }
  } finally {
    clearFundingTurboRef()
  }
}

export async function getTurboClient(walletClient, opts = {}) {
  const address = walletClient?.account?.address?.toLowerCase()
  // Feed uploads use a no-retry client so a failed POST does not re-sign in a loop
  if (opts.fast === true) {
    opts = { ...opts, fresh: true }
  }
  if (address && cachedTurboClient && cachedTurboWallet === address && !opts.fresh) {
    return { turbo: cachedTurboClient, funding: 'base-sepolia-eth' }
  }
  const result = await createUserTurboClient(walletClient, opts)
  if (opts.fast) {
    return result
  }
  if (address) {
    cachedTurboClient = result.turbo
    cachedTurboWallet = address
  }
  return result
}

export async function createUserTurboClient(walletClient, opts = {}) {
  if (walletClient?.account?.address) {
    const onStep = opts.onStep
    const onSignPrompt = opts.onSignPrompt
    const chain = resolveWalletChain(walletClient)
    const walletAdapter = createEthereumWalletAdapter(walletClient, onStep, onSignPrompt)
    const uploadServiceConfig =
      opts.fast === true
        ? {
            retryConfig: {
              retries: FEED_UPLOAD_SDK_RETRIES,
              retryDelay: () => 0,
            },
          }
        : undefined
    const turbo = TurboFactory.authenticated({
      ...TURBO_CONFIG,
      walletAdapter,
      token: 'base-eth',
      gatewayUrl: getTurboRpcUrl(chain),
      uploadServiceConfig,
    })
    patchTurboSignerPublicKey(turbo.signer, walletClient, onStep, onSignPrompt)
    return { turbo, funding: chain.id === base.id ? 'base-eth' : 'base-sepolia-eth' }
  }

  if (typeof window !== 'undefined' && window.arweaveWallet) {
    await window.arweaveWallet.connect(ARCONNECT_PERMISSIONS)
    const signer = new ArconnectSigner(window.arweaveWallet)
    return {
      turbo: TurboFactory.authenticated({ signer, ...TURBO_CONFIG }),
      funding: 'arweave',
    }
  }

  throw new Error('WALLET_NOT_CONNECTED')
}

async function pickFundingMode(turbo, walletClient, walletAddress, byteCount, onStep, uploadOpts = {}) {
  const fast = uploadOpts.fast === true
  purgeStaleFundTxs(walletAddress)
  const neededWinc = await computeNeededWinc(turbo, byteCount)

  if (!fast) {
    await tryRedeemStoredPaymentsQuick(turbo, walletAddress)
  }
  let balance = await getTurboBalanceCached(turbo, walletAddress)
  if (fast) {
    clearStaleFeedFundTxs(walletAddress, balance)
  }
  const skipPriceLookup =
    fast &&
    (wincAtLeast(balance.effectiveBalance, neededWinc) ||
      canSkipPaymentForSmallFeed(balance, byteCount, fast))
  const price = skipPriceLookup
    ? { tokenPrice: '0' }
    : await turbo.getTokenPriceForBytes({ byteCount })
  const sizeLabel =
    byteCount >= 1024 * 1024
      ? `${(byteCount / (1024 * 1024)).toFixed(1)} MB`
      : `${(byteCount / 1024).toFixed(0)} KB`

  if (wincAtLeast(balance.effectiveBalance, neededWinc)) {
    onStep?.(fast ? 'Uploading…' : `Uploading ${sizeLabel} (Turbo credits)…`)
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
  }

  if (canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
    onStep?.('Uploading…')
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
  }

  if (canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast)) {
    onStep?.('Uploading with existing credits…')
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
  }

  const pendingTxs = getStoredFundTxs(walletAddress)
  if (pendingTxs.length > 0) {
    balance = await waitForPendingFundCredits(turbo, walletAddress, neededWinc, onStep, fast, byteCount)
    if (balance && wincAtLeast(balance.effectiveBalance, neededWinc)) {
      onStep?.(fast ? 'Uploading…' : `Uploading ${sizeLabel} (credits ready)…`)
      return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
    }
    if (balance && canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
      onStep?.('Uploading…')
      return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
    }
    if (fast) {
      balance = await waitForFeedCreditsInline(
        turbo,
        walletAddress,
        neededWinc,
        onStep,
        feedCreditPollMs(byteCount, fast, balance, neededWinc),
        byteCount,
        fast,
      )
      if (balance && wincAtLeast(balance.effectiveBalance, neededWinc)) {
        clearFundTxs(walletAddress)
        onStep?.('Uploading…')
        return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
      }
      if (balance && canSkipPaymentForSmallFeed(balance, byteCount, fast)) {
        onStep?.('Uploading…')
        return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
      }
      if (balance && canAttemptFeedUploadWithAnyCredits(balance, byteCount, fast)) {
        clearFundTxs(walletAddress)
        onStep?.('Uploading with existing credits…')
        return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
      }
      if (hasRecentFeedPayment(walletAddress)) {
        balance = await redeemRecentFeedPayment(
          turbo,
          walletAddress,
          neededWinc,
          onStep,
          byteCount,
          fast,
        )
        onStep?.('Payment sent — finishing upload…')
        return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
      }
      console.warn('[ARKIVE Turbo] clearing stale fund txs — retrying funding')
      clearFundTxs(walletAddress)
    } else {
      const lastTx = pendingTxs.at(-1)
      balance = await redeemRecentFeedPayment(
        turbo,
        walletAddress,
        neededWinc,
        onStep,
        byteCount,
        fast,
      )
      onStep?.('Payment sent — finishing upload…')
      return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
    }
  }

  if (hasRecentFeedPayment(walletAddress)) {
    balance = await redeemRecentFeedPayment(
      turbo,
      walletAddress,
      neededWinc,
      onStep,
      byteCount,
      fast,
    )
    onStep?.('Payment sent — finishing upload…')
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
  }

  onStep?.(fast ? 'Step 1 of 2 — approve storage payment in MetaMask' : `File needs storage credits — preparing ${sizeLabel} upload…`)

  if (uploadOpts.skipNewPayment) {
    const balance = await redeemRecentFeedPayment(
      turbo,
      walletAddress,
      neededWinc,
      onStep,
      byteCount,
      fast,
    )
    onStep?.('Payment sent — finishing upload…')
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
  }

  await assertCanRequestEthPayment(
    walletClient,
    walletAddress,
    balance,
    neededWinc,
    byteCount,
    fast,
  )

  balance = await payForUploadCredits(turbo, walletClient, walletAddress, byteCount, onStep, { fast })
  onStep?.(fast ? 'Uploading…' : `Uploading ${sizeLabel} (credits loaded)…`)
  return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance, price }
}

function resolveChunkOpts(bytes, fast) {
  // Feed images: single signed data item — one MetaMask storage signature
  if (fast && bytes.length <= FEED_MAX_IMAGE_BYTES) {
    return { chunkingMode: 'disabled' }
  }
  if (bytes.length > 512 * 1024) {
    return {
      chunkingMode: 'force',
      chunkByteCount: TURBO_MIN_CHUNK_BYTES,
      maxChunkConcurrency: 6,
    }
  }
  return {}
}

async function runTurboUpload(turbo, bytes, _fundingMode, opts) {
  const onStep = opts.onStep
  const fast = opts.fast === true
  const chunkOpts = resolveChunkOpts(bytes, fast)
  onStep?.(fast ? 'Approve signature in MetaMask…' : 'Check MetaMask — approve the storage signature')

  const uploadTimeout = fast ? UPLOAD_TIMEOUT_FEED_MS : UPLOAD_TIMEOUT_MS

  console.info('[ARKIVE Turbo] runTurboUpload', {
    bytes: bytes.length,
    fast,
    chunkingMode: chunkOpts.chunkingMode || 'auto',
    contentType: opts.contentType,
  })

  return withTimeout(
    turbo.uploadFile({
      fileStreamFactory: () => bytes,
      fileSizeFactory: () => bytes.length,
      fundingMode: new ExistingBalanceFunding(),
      ...chunkOpts,
      dataItemOpts: {
        tags: [
          { name: 'Content-Type', value: opts.contentType || 'application/octet-stream' },
          { name: 'App-Name', value: 'ARKIVE' },
          { name: 'App-Version', value: '2.3.0' },
          { name: 'Upload-Funding', value: 'base-eth-user-wallet' },
          ...(opts.extraTags || []),
        ],
      },
      events: {
        onSigningError: (error) => {
          console.error('[ARKIVE Turbo] signing error', error)
          onStep?.('MetaMask signature failed — open MetaMask and try again')
        },
        onUploadError: (error) => {
          console.error('[ARKIVE Turbo] upload error', error)
        },
        ...(opts.onProgress
          ? {
              onProgress: ({ totalBytes, processedBytes }) => {
                if (totalBytes > 0) {
                  opts.onProgress(Math.round((processedBytes / totalBytes) * 100))
                }
              },
            }
          : {}),
      },
    }),
    uploadTimeout,
    'TURBO_UPLOAD_TIMEOUT',
  )
}

/** Dev helper — log Turbo balance/cost without uploading. */
export async function diagnoseTurboWallet(walletClient, byteCount = 50_000) {
  const { turbo } = await createUserTurboClient(walletClient)
  const address = walletClient.account.address
  const turboAddress = await turbo.signer.getNativeAddress()
  const [{ winc }] = await turbo.getUploadCosts({ bytes: [byteCount] })
  const balance = await turbo.getBalance(address)
  const price = await turbo.getTokenPriceForBytes({ byteCount })
  return {
    walletAddress: address,
    turboAddress,
    addressMatch: turboAddress.toLowerCase() === address.toLowerCase(),
    uploadCostWinc: winc,
    effectiveBalanceWinc: balance.effectiveBalance,
    tokenPriceEth: price.tokenPrice,
    pendingFundTxs: getStoredFundTxs(address),
  }
}

async function resolveUploadFunding(turbo, walletClient, walletAddress, byteCount, onStep, opts) {
  const fast = opts.fast === true
  const validPrepared = normalizePreparedFunding(opts.preparedFunding)

  if (opts.skipNewPayment) {
    const neededWinc = await computeNeededWinc(turbo, byteCount)
    const balance = await redeemRecentFeedPayment(
      turbo,
      walletAddress,
      neededWinc,
      onStep,
      byteCount,
      fast,
    )
    onStep?.('Payment sent — finishing upload…')
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance }
  }

  if (validPrepared) {
    const { fundingMode, neededWinc, balance } = validPrepared
    const canUse = creditsCoverUpload(balance, neededWinc, byteCount, fast)
    if (canUse) {
      return validPrepared
    }
  }

  if (opts.creditsReady) {
    const balance = await getTurboBalanceCached(turbo, walletAddress)
    const neededWinc = await computeNeededWinc(turbo, byteCount)
    return { fundingMode: new ExistingBalanceFunding(), neededWinc, balance }
  }

  return pickFundingMode(turbo, walletClient, walletAddress, byteCount, onStep, opts)
}

export async function uploadBytesViaUserWallet(walletClient, data, opts = {}) {
  const uploadStarted = performance.now()
  const bytes = toUploadBytes(data)
  const onStep = opts.onStep
  const onSignPrompt = opts.onSignPrompt
  const walletAddress = walletClient.account.address
  const fast = opts.fast === true
  const walletKey = walletAddress.toLowerCase()
  const chain = resolveWalletChain(walletClient)
  const fundingByteCount = resolveFundingByteCount(bytes.length, opts)

  purgeStaleFundTxs(walletKey)

  resetBinarySignPromptConsumed()
  setUploadSignPromptHandler(onSignPrompt ?? null)

  const linkCached =
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TURBO_PUBKEY_PREFIX + walletKey)

  if (!linkCached) {
    const linkStart = performance.now()
    onStep?.('Open MetaMask — approve the wallet link (one-time, not a transaction)')
    await warmTurboWalletLink(walletClient, onStep, onSignPrompt)
    logTurboPhase('wallet-link', linkStart)
  } else if (fast) {
    onStep?.('Approve signature in MetaMask…')
  }

  const clientStart = performance.now()
  const clientPromise = getTurboClient(walletClient, { onStep, onSignPrompt, fast })
  const { turbo } = await clientPromise
  logTurboPhase('turbo-client', clientStart)
  setFundingTurbo(turbo)
  hydrateTurboPublicKey(turbo.signer, walletKey)

  try {
    const turboAddress = await turbo.signer.getNativeAddress()
    if (turboAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('TURBO_WALLET_MISMATCH')
    }

    let { fundingMode, neededWinc, balance } = await resolveUploadFunding(
      turbo,
      walletClient,
      walletAddress,
      fundingByteCount,
      onStep,
      opts,
    )

    logTurboPhase('funding-ready', uploadStarted, {
      bytes: bytes.length,
      fundingByteCount,
      balance: balance?.effectiveBalance,
      neededWinc,
      skipSmallFeed: canSkipPaymentForSmallFeed(balance, fundingByteCount, fast),
    })

    if (
      fast &&
      hasRecentFeedPayment(walletAddress) &&
      !shouldProceedToUploadAfterPayment(balance, neededWinc, fundingByteCount, fast)
    ) {
      onStep?.('Payment sent — finishing upload…')
      logPostPaymentPhase('attempt-upload-low-balance', performance.now(), {
        balance: balance?.effectiveBalance,
        neededWinc,
      })
    }

    if (
      normalizePreparedFunding(opts.preparedFunding) &&
      balance?.effectiveBalance != null &&
      neededWinc != null &&
      !creditsCoverUpload(balance, neededWinc, fundingByteCount, fast) &&
      fundingMode instanceof ExistingBalanceFunding
    ) {
      onStep?.('Refreshing storage credits…')
      ;({ fundingMode, neededWinc, balance } = await pickFundingMode(
        turbo,
        walletClient,
        walletAddress,
        fundingByteCount,
        onStep,
        opts,
      ))
    }

    console.info('[ARKIVE Turbo] upload start', {
      bytes: bytes.length,
      fast,
      contentType: opts.contentType,
      neededWinc,
      balance: balance.effectiveBalance,
    })

    let response
    let uploadRetryCount = 0
    const uploadStart = performance.now()
    const recentPaymentBeforeUpload = hasRecentFeedPayment(walletAddress)

    async function attemptUploadAfterCreditPoll() {
      onStep?.('Payment sent — finishing upload…')
      const polled = await redeemRecentFeedPayment(
        turbo,
        walletAddress,
        neededWinc,
        onStep,
        fundingByteCount,
        fast,
      )
      if (
        wincAtLeast(polled.effectiveBalance, neededWinc) ||
        canSkipPaymentForSmallFeed(polled, fundingByteCount, fast)
      ) {
        clearFundTxs(walletAddress)
        balance = polled
      }
      uploadRetryCount++
      console.info('[ARKIVE Turbo] upload retry after credit poll', { uploadRetryCount })
      return runTurboUpload(turbo, bytes, new ExistingBalanceFunding(), opts)
    }

    try {
      response = await runTurboUpload(turbo, bytes, fundingMode, opts)
    } catch (firstError) {
      uploadRetryCount++
      const msg =
        firstError?.shortMessage ||
        firstError?.message ||
        String(firstError)
      const creditFail = isUploadCreditFailure(firstError)

      if (msg.includes('Failed to submit fund transaction')) {
        console.warn('[ARKIVE Turbo] fund submit failed, recovering', msg)
        const credited = await recoverFailedFundSubmit(
          turbo,
          walletAddress,
          msg,
          onStep,
          neededWinc,
        )
        if (credited) {
          onStep?.('Retrying upload with credited balance…')
          uploadRetryCount++
          console.info('[ARKIVE Turbo] upload retry after fund credit', { uploadRetryCount })
          response = await runTurboUpload(
            turbo,
            bytes,
            new ExistingBalanceFunding(),
            opts,
          )
        } else if (hasRecentFeedPayment(walletAddress) || fast) {
          const txId = extractTxHash(msg) || getStoredFundTxs(walletAddress).at(-1)
          logPostPaymentPhase('upload-retry-after-fund-submit-fail', performance.now(), { txId })
          let lastRetryError = firstError
          for (let i = 0; i < POST_PAYMENT_UPLOAD_RETRIES; i++) {
            try {
              response = await attemptUploadAfterCreditPoll()
              lastRetryError = null
              break
            } catch (retryError) {
              lastRetryError = retryError
              if (!isUploadCreditFailure(retryError) || i >= POST_PAYMENT_UPLOAD_RETRIES - 1) break
            }
          }
          if (!response) {
            throw new Error(
              feedUploadAfterPaymentError(
                txId,
                'Payment received — click Retry upload. Storage will not be charged again.',
              ),
            )
          }
        } else {
          const txId = extractTxHash(msg) || getStoredFundTxs(walletAddress).at(-1)
          throw new Error(
            `TURBO_FUND_PENDING:${txId || 'unknown'}:${feedFundPendingError(txId, chain)}`,
          )
        }
      } else if (creditFail) {
        console.warn('[ARKIVE Turbo] credits path failed, polling then retry…', {
          msg,
          uploadRetryCount,
          pendingFundTxs: getStoredFundTxs(walletAddress).length,
        })
        const hadPending = getStoredFundTxs(walletAddress).length > 0 || recentPaymentBeforeUpload
        if (hadPending || fast) {
          logPostPaymentPhase('upload-retry-after-402', performance.now(), { msg })
          let lastRetryError = firstError
          for (let i = 0; i < POST_PAYMENT_UPLOAD_RETRIES; i++) {
            try {
              response = await attemptUploadAfterCreditPoll()
              lastRetryError = null
              break
            } catch (retryError) {
              lastRetryError = retryError
              if (!isUploadCreditFailure(retryError) || i >= POST_PAYMENT_UPLOAD_RETRIES - 1) break
            }
          }
          if (!response) {
            const txId = getStoredFundTxs(walletAddress).at(-1) || 'unknown'
            throw new Error(
              feedUploadAfterPaymentError(
                txId,
                'Payment received — click Retry upload. Storage will not be charged again.',
              ),
            )
          }
        } else {
          onStep?.('Topping up credits and retrying…')
          await assertCanRequestEthPayment(
            walletClient,
            walletAddress,
            balance,
            neededWinc,
            fundingByteCount,
            fast,
          )
          await payForUploadCredits(turbo, walletClient, walletAddress, fundingByteCount, onStep, {
            fast,
          })
          uploadRetryCount++
          console.info('[ARKIVE Turbo] upload retry after top-up', { uploadRetryCount })
          response = await runTurboUpload(turbo, bytes, new ExistingBalanceFunding(), opts)
        }
      } else {
        throw firstError
      }
    }

    logTurboPhase('turbo-upload', uploadStart, { id: response.id, uploadRetryCount })
    logTurboPhase('upload-total', uploadStarted, { id: response.id, bytes: bytes.length })

    console.info('[ARKIVE Turbo] upload ok', { id: response.id, uploadRetryCount })

    clearFeedUploadPending(walletAddress)
    if (hasRecentFeedPayment(walletAddress) || wincAtLeast(balance.effectiveBalance, neededWinc)) {
      clearFundTxs(walletAddress)
    }

    if (!response?.id || typeof response.id !== 'string') {
      throw new Error('TURBO_UPLOAD_REJECTED:Upload completed without an Arweave transaction ID')
    }

    const cachePayload =
      opts.cacheBytes && opts.cacheBytes.length <= 12 * 1024 * 1024
        ? toUploadBytes(opts.cacheBytes)
        : null
    if (cachePayload) {
      try {
        await setCachedBytes(response.id, cachePayload)
      } catch (cacheErr) {
        console.warn('[ARKIVE Turbo] cache skipped', cacheErr)
      }
    }

    warmArweaveCacheInBackground(response.id)
    cacheSessionBalance(walletAddress, balance.effectiveBalance)

    return response.id
  } catch (error) {
    const status = error?.status ?? error?.statusCode
    const message =
      error?.shortMessage ||
      error?.details ||
      error?.cause?.shortMessage ||
      error?.cause?.message ||
      error?.message ||
      String(error)
    if (
      !message.includes('TIMEOUT') &&
      !message.includes('WALLET_SIGN') &&
      !message.includes('TURBO_FUND_PENDING') &&
      !message.includes('TURBO_UPLOAD_AFTER_PAYMENT')
    ) {
      clearTurboClientCache()
    }
    console.error('[ARKIVE Turbo] upload failed', { message, status, error })

    if (fast && (hasRecentFeedPayment(walletAddress) || message.includes('TURBO_UPLOAD_AFTER_PAYMENT'))) {
      const paidTxHash = getStoredFundTxs(walletAddress).at(-1)
      saveFeedUploadPending(walletAddress, {
        paidTxHash,
        byteCount: bytes.length,
        contentType: opts.contentType || 'application/octet-stream',
      })
      logPostPaymentPhase('upload-failed-after-payment', performance.now(), {
        paidTxHash,
        message,
      })
    }

    if (message === 'ARWEAVE_VERIFY_FAILED') {
      throw new Error(
        'ARWEAVE_VERIFY_FAILED: Upload accepted but file did not appear on Arweave. Wait 1 minute and try sealing again.',
      )
    }
    if (message === 'TURBO_CREDITS_TIMEOUT') {
      throw new Error(
        'TURBO_CREDITS_TIMEOUT: Payment confirmed but Turbo credits are slow. Wait 1 minute and retry — you should not pay again.',
      )
    }
    if (status === 402 || message.toLowerCase().includes('insufficient')) {
      throw new Error(
        `TURBO_INSUFFICIENT_CREDITS:File too large for your Turbo balance. Approve the full ETH amount MetaMask shows (~${(bytes.length / 1024 / 1024).toFixed(1)} MB file).`,
      )
    }
    if (message.toLowerCase().includes('quota') || message.includes('QuotaExceeded')) {
      throw new Error('BROWSER_STORAGE_FULL')
    }
    if (message.toLowerCase().includes('out of memory') || message.includes('allocation')) {
      throw new Error('FILE_TOO_LARGE_FOR_BROWSER')
    }
    if (message.includes('Failed request')) {
      throw new Error(`TURBO_UPLOAD_REJECTED:${message}`)
    }
    if (message.includes('Failed to submit fund transaction')) {
      const txId = extractTxHash(message)
      throw new Error(
        `TURBO_FUND_PENDING:${txId || 'unknown'}:Your ETH payment was sent. Wait 1 minute and click Encrypt & store again — you should not pay twice.`,
      )
    }
    if (message.startsWith('TURBO_FUND_PENDING')) {
      if (fast && hasRecentFeedPayment(walletAddress)) {
        const txId = getStoredFundTxs(walletAddress).at(-1) || 'unknown'
        throw new Error(
          feedUploadAfterPaymentError(
            txId,
            'Payment received — click Retry upload. Storage will not be charged again.',
          ),
        )
      }
      throw new Error(message)
    }
    if (message.startsWith('TURBO_UPLOAD_AFTER_PAYMENT')) {
      throw new Error(message)
    }
    if (
      message.startsWith('TURBO_FUND_WRONG_TX') ||
      message.startsWith('TURBO_SMART_ACCOUNT_BLOCKED') ||
      message.startsWith('TURBO_MISROUTE_BLOCKED')
    ) {
      throw new Error('TURBO_FUND_WRONG_TX')
    }
    if (message.startsWith('TURBO_FUND_REJECTED')) {
      throw new Error(
        'Turbo rejected the ETH payment. Check Base Sepolia explorer for the tx, then retry or contact support.',
      )
    }
    if (message.toLowerCase().includes('failed to fetch') || message.includes('NetworkError')) {
      throw new Error(
        'TURBO_NETWORK_ERROR:Could not reach Turbo storage. Hard-refresh, disable ad blockers, check Base Sepolia in MetaMask, then retry.',
      )
    }
    throw error
  } finally {
    clearFundingTurboRef()
    clearUploadSignPromptHandler()
  }
}

/**
 * Feed uploads — prefer app sponsor when configured (one signature), else user Turbo.
 * Vault must use uploadBytesViaUserWallet (user-paid encrypted storage).
 */
export async function uploadFeedBytes(walletClient, data, opts = {}) {
  const feedOpts = { ...opts, fast: true }

  // Sponsor-first for feed: avoids wallet-link / ETH / credit races that break short posts.
  try {
    const { checkSponsorHealth, sponsorFeedUpload } = await import('./sponsorUpload.js')
    const health = await checkSponsorHealth()
    if (health.ok && health.configured) {
      console.info('[ARKIVE sponsor] feed using sponsor-first path')
      feedOpts.onStep?.('Open MetaMask — approve sponsor upload signature…')
      return await sponsorFeedUpload(walletClient, data, {
        contentType: opts.contentType,
        onStep: opts.onStep,
        onSignPrompt: opts.onSignPrompt,
      })
    }
  } catch (sponsorFirstError) {
    if (!isSponsorEligibleFailure(sponsorFirstError) && !String(sponsorFirstError?.message || '').startsWith('SPONSOR_')) {
      // User rejected sponsor auth — don't silently fall through to another MetaMask maze
      const msg = sponsorFirstError?.message || String(sponsorFirstError)
      if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
        throw sponsorFirstError
      }
    }
    console.info('[ARKIVE sponsor] sponsor-first failed — trying user Turbo', {
      reason: sponsorFirstError?.message || String(sponsorFirstError),
    })
  }

  try {
    return await uploadBytesViaUserWallet(walletClient, data, feedOpts)
  } catch (error) {
    if (!isSponsorEligibleFailure(error)) throw error
    console.info('[ARKIVE sponsor] feed user upload failed — trying sponsor fallback', {
      reason: error?.message || String(error),
    })
    feedOpts.onStep?.('Uploading…')
    const { sponsorFeedUpload } = await import('./sponsorUpload.js')
    return sponsorFeedUpload(walletClient, data, {
      contentType: opts.contentType,
      onStep: opts.onStep,
      onSignPrompt: opts.onSignPrompt,
    })
  }
}

export function canUploadViaWallet(walletClient) {
  return Boolean(walletClient?.account?.address) || (typeof window !== 'undefined' && window.arweaveWallet)
}

/** Pre-warm Turbo client when vault opens — saves ~2s on first upload */
export function warmTurboForWallet(walletClient) {
  if (!walletClient?.account?.address) return
  void getTurboClient(walletClient).catch(() => {})
}

/**
 * Retry feed upload after ETH payment — never charges again while fund tx is recent (<5 min).
 */
export async function retryFeedUploadAfterPayment(walletClient, payload, opts = {}) {
  const walletAddress = walletClient.account.address
  const pending = getFeedUploadPending(walletAddress)
  const data = payload?.data ?? payload
  const contentType = payload?.contentType || opts.contentType || 'application/octet-stream'
  const byteCount =
    payload?.byteCount ??
    opts.byteCount ??
    (typeof data === 'string'
      ? new TextEncoder().encode(data).length
      : data?.length ?? data?.byteLength ?? 0)

  logPostPaymentPhase('retry-start', performance.now(), {
    paidTxHash: pending?.paidTxHash || getStoredFundTxs(walletAddress).at(-1),
    byteCount,
  })

  try {
    return await uploadBytesViaUserWallet(walletClient, data, {
      ...opts,
      contentType,
      byteCount,
      fast: true,
      skipNewPayment: true,
      onStep: opts.onStep,
      onSignPrompt: opts.onSignPrompt,
    })
  } catch (error) {
    if (!isSponsorEligibleFailure(error)) throw error
    console.info('[ARKIVE sponsor] feed retry failed — trying sponsor fallback', {
      reason: error?.message || String(error),
    })
    opts.onStep?.('Uploading…')
    const { sponsorFeedUpload } = await import('./sponsorUpload.js')
    return sponsorFeedUpload(walletClient, data, {
      contentType,
      onStep: opts.onStep,
      onSignPrompt: opts.onSignPrompt,
    })
  }
}

/**
 * Feed shortcut — wallet link + credit check while the create-post modal is open.
 * Pass byteCount (e.g. estimateBundleByteCount(image.size)) for image posts.
 */
export async function prepareFeedUpload(walletClient, onStep, byteCount = 512) {
  const walletAddress = walletClient.account.address
  const key = walletAddress.toLowerCase()
  const uploadBytes = estimateBundleByteCount(byteCount)
  const cacheKey = `${key}:${uploadBytes}`
  if (
    feedPrepCache?.cacheKey === cacheKey &&
    Date.now() - feedPrepCache.at < 60_000
  ) {
    return feedPrepCache
  }
  const linkReady =
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TURBO_PUBKEY_PREFIX + key)

  const linkPromise = linkReady
    ? Promise.resolve()
    : warmTurboWalletLink(walletClient, onStep)

  const clientPromise = getTurboClient(walletClient, { onStep })

  await linkPromise
  const { turbo } = await clientPromise
  hydrateTurboPublicKey(turbo.signer, key)

  let balance = { effectiveBalance: '0' }
  let neededWinc = '0'
  let hasCredits = false
  let skipEthPayment = false
  let skipPaymentSmall = false
  purgeStaleFundTxs(walletAddress)
  let pendingFundTxs = getStoredFundTxs(walletAddress)
  try {
    ;[balance, neededWinc] = await Promise.all([
      getTurboBalanceCached(turbo, walletAddress),
      computeNeededWinc(turbo, uploadBytes),
    ])
    if (clearStaleFeedFundTxs(walletAddress, balance)) {
      pendingFundTxs = []
    }
    hasCredits = wincAtLeast(balance.effectiveBalance, neededWinc)
    skipPaymentSmall = canSkipPaymentForSmallFeed(balance, uploadBytes, true)
    skipEthPayment = creditsCoverUpload(balance, neededWinc, uploadBytes, true)

    if (skipEthPayment) {
      onStep?.('Storage credits ready — signature only')
    } else if (pendingFundTxs.length > 0) {
      onStep?.('Finishing previous upload…')
    }
  } catch {
    /* balance lookup optional during prep */
  }

  feedPrepCache = {
    address: key,
    cacheKey,
    at: Date.now(),
    hasCredits,
    skipEthPayment,
    byteCount: uploadBytes,
    neededWinc,
    balanceWinc: balance.effectiveBalance,
    preparedFunding: skipEthPayment
      ? normalizePreparedFunding({
          fundingMode: new ExistingBalanceFunding(),
          neededWinc,
          balance,
        })
      : null,
  }
  return feedPrepCache
}
