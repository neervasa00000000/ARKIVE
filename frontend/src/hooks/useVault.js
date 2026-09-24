import { decryptVaultContent, decryptVaultWithPassphrase } from '../lib/vaultCrypto'
import { requireSuccessfulReceipt } from '../lib/transactionReceipt'
// frontend/src/hooks/useVault.js
import { useState, useRef } from 'react'
import { useAccount, useWalletClient, useWriteContract, useChainId } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { wagmiConfig } from '../config/wagmi'
import { baseSepolia } from 'viem/chains'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import VaultRegistryABI from '../contracts/VaultRegistry.json'
import { getLitClient } from '../config/lit'
import {
  bytesToBase64,
  base64ToBytes,
  sanitizeFileName,
  assertVaultPayloadOwnership,
  validateSealFileDeep,
  safeBlobMimeType,
  assertSafeDecryptedContent,
  validateArweaveTxId,
  normalizeEthAddress,
} from '../lib/security'
import {
  uploadBytesViaUserWallet,
  estimateUploadCost,
  estimateBundleByteCount,
} from '../lib/turboUpload'
import { useTurboSignPrompt } from './useTurboSignPrompt'
import { encodeVaultBundle, VAULT_SCHEMA_V3, parseVaultBytes } from '../lib/vaultBundle'
import { loadVaultBundleBytes, rememberVaultBundle } from '../lib/vaultLocal'
import {
  availableRecoveryMethods,
  assertRecoveryTestCompatible,
  createRecoveryTestRecord,
  saveRecoveryTestRecord,
  testPassphraseRecovery,
  verifyExactRecovery,
} from '../lib/recoveryTest'
import {
  withRecoverySpecFields,
  RECOVERY_DISCOVERY_STATE,
} from '../lib/recoverySpec'
import { finalizeAfterStorageRid } from '../lib/ridCustody'
import {
  DERIVATION_VERSION_EIP712,
  buildEip712Domain,
  deriveKeyForPayload,
  deriveKeyFromWalletV2,
} from '../lib/vaultDerivation'
import {
  generateAesKey,
  exportRawKey,
  importRawKey,
  aesEncrypt,
  aesDecrypt,
  wrapFileKeyForWallet,
  wrapFileKeyForPassphrase,
  unwrapFileKeyWithWallet,
  unwrapFileKeyWithPassphrase,
  findWalletKeyWrap,
  listAuthorizedWallets,
  MAX_AUTHORISED_WALLETS,
  sha256Hex,
  encryptVaultMetadata,
  decryptVaultMetadata,
} from '../lib/vaultKeyWrap'

/** Session cache: backup address → CryptoKey from EIP-712 (cleared after seal) */
const backupDerivedKeyByAddress = new Map()

const ZERO = '0x0000000000000000000000000000000000000000'

export function useVault() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const { onSignPrompt, SignPromptModal } = useTurboSignPrompt()
  const pendingRegistration = useRef(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  async function getStorageEstimate(file) {
    if (!walletClient || !file) return null
    try {
      return await estimateUploadCost(walletClient, file.size)
    } catch {
      return null
    }
  }

  /**
   * Switch MetaMask to the backup address, then call this so the seal can wrap
   * the file key for that wallet. Switch back to your main wallet before sealing.
   */
  async function authorizeBackupWallet(backupAddress) {
    if (!walletClient || !address) throw new Error('WALLET_NOT_CONNECTED')
    const backup = normalizeEthAddress(backupAddress)
    const connected = normalizeEthAddress(address)
    if (backup !== connected) throw new Error('BACKUP_WALLET_NOT_CONNECTED')
    if (chainId !== 84532) throw new Error('WRONG_NETWORK')

    setStep('Open MetaMask — approve backup vault key signature…')
    try {
      const derivedKey = await deriveKeyFromWalletV2(walletClient, backup)
      backupDerivedKeyByAddress.set(backup, derivedKey)
      setStep('')
      return { wallet: backup, authorised: true }
    } finally {
      setStep('')
    }
  }

  async function storeFile(file, opts = {}) {
    setLoading(true)
    setUploadProgress(0)
    let arweaveId
    try {
      if (!isConnected || !address || !walletClient) {
        throw new Error('WALLET_NOT_CONNECTED')
      }
      if (chainId !== 84532) throw new Error('WRONG_NETWORK')
      if (CONTRACT_ADDRESSES.VaultRegistry === ZERO) {
        throw new Error('CONTRACTS_NOT_DEPLOYED')
      }

      if (pendingRegistration.current?.file === file && pendingRegistration.current.owner === address.toLowerCase()) {
        return await registerPendingVault()
      }

      await validateSealFileDeep(file)

      const owner = normalizeEthAddress(address)
      const backupAddresses = []
      const rawBackups = [
        ...(Array.isArray(opts.backupAddresses) ? opts.backupAddresses : []),
        ...(opts.backupAddress ? [opts.backupAddress] : []),
      ]
      for (const raw of rawBackups) {
        if (!raw || typeof raw !== 'string') continue
        const backup = normalizeEthAddress(raw.trim())
        if (backup === owner) throw new Error('BACKUP_WALLET_SAME_AS_OWNER')
        if (!backupAddresses.includes(backup)) backupAddresses.push(backup)
      }
      if (1 + backupAddresses.length > MAX_AUTHORISED_WALLETS) {
        throw new Error('TOO_MANY_AUTHORISED_WALLETS')
      }

      const recoveryPassphrase =
        typeof opts.recoveryPassphrase === 'string' && opts.recoveryPassphrase.length > 0
          ? opts.recoveryPassphrase
          : null
      if (recoveryPassphrase && recoveryPassphrase.length < 8) {
        throw new Error('RECOVERY_PASSPHRASE_TOO_SHORT')
      }

      for (const backup of backupAddresses) {
        if (!backupDerivedKeyByAddress.get(backup)) {
          throw new Error('BACKUP_WALLET_NOT_AUTHORISED')
        }
      }

      setStep('Open MetaMask — approve vault key signature…')

      setStep('Encrypting…')
      const [fileBytes, ownerDerivedKey, fileAesKey] = await Promise.all([
        file.arrayBuffer().then((b) => new Uint8Array(b)),
        deriveKeyFromWalletV2(walletClient, owner),
        generateAesKey(),
      ])
      const rawFileAesKey = await exportRawKey(fileAesKey)
      const { encrypted: encryptedFile, iv: fileIv } = await aesEncrypt(fileAesKey, fileBytes)
      const contentHash = await sha256Hex(encryptedFile)

      const safeName = sanitizeFileName(file.name)
      const metaFields = {
        originalContentHash: await sha256Hex(fileBytes),
        originalFileName: safeName,
        originalFileType: file.type,
        originalFileSize: fileBytes.length,
      }
      const { encryptedMetadata, encryptedMetadataIv } = await encryptVaultMetadata(
        fileAesKey,
        metaFields,
      )

      const ownerWrap = await wrapFileKeyForWallet(ownerDerivedKey, rawFileAesKey, owner)
      const keyWraps = [ownerWrap]

      for (const backup of backupAddresses) {
        const backupDerivedKey = backupDerivedKeyByAddress.get(backup)
        keyWraps.push(await wrapFileKeyForWallet(backupDerivedKey, rawFileAesKey, backup))
      }

      let recoveryWrap = null
      if (recoveryPassphrase) {
        recoveryWrap = await wrapFileKeyForPassphrase(rawFileAesKey, recoveryPassphrase)
      }

      rawFileAesKey.fill(0)

      const authorizedWallets = listAuthorizedWallets({
        encryptedByWallet: owner,
        keyWraps,
        authorizedWallets: [owner, ...backupAddresses],
      })

      const vaultHeader = {
        version: 'v3',
        schema: VAULT_SCHEMA_V3,

        encryptedFileIv: bytesToBase64(fileIv),
        contentHash,

        litCiphertext: null,
        litDataToEncryptHash: null,
        litAccessConditions: null,
        litChain: 'baseSepolia',

        // Legacy single-wrap fields (owner) — kept for older retrieve paths
        walletEncryptedAesKey: ownerWrap.encryptedAesKey,
        walletEncryptedAesKeyIv: ownerWrap.iv,
        walletAddress: owner,
        derivationVersion: DERIVATION_VERSION_EIP712,
        eip712Domain: buildEip712Domain(),

        keyWraps,
        authorizedWallets,
        recoveryWrap,
        hasRecoveryPassphrase: Boolean(recoveryWrap),

        // Sensitive metadata is encrypted; on-chain uses a generic label
        encryptedMetadata,
        encryptedMetadataIv,
        originalFileName: 'sealed-record',
        originalFileType: 'application/octet-stream',
        originalFileSize: fileBytes.length,

        recoveryInstructions: {
          step1: 'Keep an offline .arkive copy and/or the Arweave TX id (Archive ID)',
          step2: 'Connect an authorised wallet (1 of up to 3) or enter the recovery passphrase',
          step3: 'Follow docs/RECOVERY-SPEC.md if the ARKIVE app no longer exists',
          step4: 'Decrypt metadata with the file key after unwrap — see encryptedMetadata fields',
        },

        encryptedAt: Date.now(),
        encryptedByWallet: owner,
      }

      // Spec v1 fields — archiveId stamped after upload for offline package
      Object.assign(vaultHeader, withRecoverySpecFields(vaultHeader))

      const arweaveBundle = encodeVaultBundle(vaultHeader, encryptedFile)
      const fastUpload = arweaveBundle.length <= 512 * 1024
      const uploadOpts = { fast: fastUpload }

      const fundingBytes = estimateBundleByteCount(arweaveBundle.length)

      setStep('Step 1 of 2 — uploading to Arweave (signatures + ETH if needed)…')
      arweaveId = await uploadBytesViaUserWallet(walletClient, arweaveBundle, {
        contentType: 'application/octet-stream',
        cacheBytes: arweaveBundle.length <= 12 * 1024 * 1024 ? arweaveBundle : null,
        byteCount: fundingBytes,
        extraTags: [{ name: 'Encryption', value: 'dual-AES256GCM-Lit-WalletDerived' }],
        onStep: setStep,
        onProgress: setUploadProgress,
        onSignPrompt,
        ...uploadOpts,
      })

      arweaveId = validateArweaveTxId(arweaveId)

      for (const backup of backupAddresses) {
        backupDerivedKeyByAddress.delete(backup)
      }

      const fileType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type === 'application/pdf'
            ? 'document'
            : 'other'

      setStep('Step 2 of 2 — approve on-chain vault record in MetaMask')
      const conditionsHash = `wallet:${owner}`

      // INVARIANT: stamp recovery artifact as soon as RID exists — before Base registration.
      const custody = await finalizeAfterStorageRid({
        header: vaultHeader,
        encryptedFileBytes: encryptedFile,
        storageRid: arweaveId,
        originalFileName: safeName,
        registerOnChain: null,
      })
      void rememberVaultBundle(arweaveId, custody.offlinePackage)

      const result = {
        success: true,
        uploadSucceeded: true,
        registrationSucceeded: false,
        arweaveId,
        archiveId: arweaveId,
        fileName: safeName,
        fileType: file.type,
        authorizedWallets,
        hasRecoveryPassphrase: Boolean(recoveryWrap),
        offlinePackage: custody.offlinePackage,
        offlineFileName: custody.offlineFileName,
        storageLocations: custody.storageLocations,
        recoveryDiscoveryState: RECOVERY_DISCOVERY_STATE.RID_STAMPED,
        recoveryArtifactAvailable: true,
      }
      pendingRegistration.current = { file, owner, arweaveId, fileType, conditionsHash, result }
      return await registerPendingVault()

    } catch (error) {
      setStep('')
      setUploadProgress(0)
      // If RID + stamped package already exist on pending, surface them even on unexpected throws.
      const pending = pendingRegistration.current
      if (
        pending?.result?.offlinePackage &&
        pending?.arweaveId &&
        typeof arweaveId === 'string' &&
        arweaveId.length > 20
      ) {
        const msg = error?.message || String(error)
        const detail =
          msg.includes('user rejected') || msg.includes('User rejected')
            ? 'Upload succeeded but registration was cancelled. Download your recovery copy — it contains the storage identifier.'
            : `Upload succeeded but blockchain registration failed. Download your recovery copy — it contains the storage identifier. (${msg})`
        return {
          ...pending.result,
          success: true,
          uploadSucceeded: true,
          registrationSucceeded: false,
          registrationError: detail,
          recoveryDiscoveryState: RECOVERY_DISCOVERY_STATE.RID_STAMPED,
          recoveryArtifactAvailable: true,
        }
      }
      console.error('Vault store failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function registerPendingVault() {
    const pending = pendingRegistration.current
    if (!pending?.result) throw new Error('NO_PENDING_REGISTRATION')

    // Stamped recovery artifact must already be available before Base is consulted.
    if (!pending.result.offlinePackage || !pending.result.recoveryArtifactAvailable) {
      throw new Error('RECOVERY_ARTIFACT_REQUIRED_BEFORE_REGISTRY')
    }

    setStep('Approve or confirm the on-chain vault record…')
    try {
      if (!pending.hash) {
        pending.hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.VaultRegistry,
          abi: VaultRegistryABI.abi,
          functionName: 'storeFile',
          args: [pending.arweaveId, 'sealed-record', pending.fileType, pending.conditionsHash],
          account: address,
          chain: baseSepolia,
        })
      }
      await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash: pending.hash })
      pending.result = {
        ...pending.result,
        registrationSucceeded: true,
        registrationError: null,
        recoveryDiscoveryState: RECOVERY_DISCOVERY_STATE.REGISTRY_CONFIRMED,
      }
      const result = pending.result
      pendingRegistration.current = null
      setStep('')
      return result
    } catch (error) {
      if (error.message?.startsWith('TRANSACTION_REVERTED')) pending.hash = null
      const msg = error?.message || String(error)
      const detail =
        msg.includes('user rejected') || msg.includes('User rejected')
          ? 'Remote encrypted storage upload succeeded. Blockchain registry registration was cancelled. Your recovery copy contains the storage identifier — preserve it.'
          : `Remote encrypted storage upload succeeded. Blockchain registry registration failed. Your recovery copy contains the storage identifier — preserve it. (${msg})`
      // Do NOT clear pending — retry registration without re-upload.
      // Do NOT withhold the stamped artifact.
      pending.result = {
        ...pending.result,
        success: true,
        uploadSucceeded: true,
        registrationSucceeded: false,
        registrationError: detail,
        recoveryDiscoveryState: RECOVERY_DISCOVERY_STATE.RID_STAMPED,
        recoveryArtifactAvailable: true,
      }
      setStep('')
      return pending.result
    }
  }

  const decryptContentWithFileKey = decryptVaultContent

  async function decryptWithLit(payload) {
    if (!payload.litCiphertext) throw new Error('No Lit encryption data in payload')

    const litClient = await getLitClient()

    const sessionSigs = await litClient.getSessionSigs({
      chain: 'baseSepolia',
      expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      resourceAbilityRequests: [
        {
          resource: { resourcePrefix: 'lit-accesscontrol://*' },
          ability: 'access-control-condition-decryption',
        },
      ],
    })

    const decryptedAesKeyBytes = await litClient.decrypt({
      accessControlConditions: payload.litAccessConditions,
      ciphertext: payload.litCiphertext,
      dataToEncryptHash: payload.litDataToEncryptHash,
      sessionSigs,
      chain: 'baseSepolia',
    })

    const fileAesKey = await importRawKey(decryptedAesKeyBytes)
    return decryptContentWithFileKey(fileAesKey, payload)
  }

  async function decryptWithWallet(payload) {
    if (!walletClient || !address) throw new Error('WALLET_NOT_CONNECTED')

    assertVaultPayloadOwnership(payload, address)

    const wrap = findWalletKeyWrap(payload, address)
    if (!wrap) throw new Error('NO_WALLET_KEY_WRAP')

    const derivedKey = await deriveKeyForPayload(walletClient, address, payload)
    const rawFileAesKey = await unwrapFileKeyWithWallet(derivedKey, wrap)
    const fileAesKey = await importRawKey(rawFileAesKey)
    rawFileAesKey.fill(0)
    return decryptContentWithFileKey(fileAesKey, payload)
  }

  const decryptWithPassphrase = decryptVaultWithPassphrase

  async function retrieveAndDecryptFile(arweaveId, opts = {}) {
    const forceWalletFallback = opts === true || opts?.forceWalletFallback === true
    const recoveryPassphrase = typeof opts?.recoveryPassphrase === 'string' ? opts.recoveryPassphrase : null

    setLoading(true)
    try {
      if (!recoveryPassphrase && (!address || !walletClient)) {
        throw new Error('WALLET_NOT_CONNECTED')
      }

      setStep('Loading encrypted bundle…')
      const { bytes, source } = await loadVaultBundleBytes(arweaveId)
      const parsed = parseVaultBytes(bytes)

      let payload
      if (recoveryPassphrase) {
        payload = parsed
        if (!payload.recoveryWrap) throw new Error('NO_RECOVERY_WRAP')
      } else {
        payload = assertVaultPayloadOwnership(parsed, address)
      }

      setStep(
        recoveryPassphrase
          ? 'Unlocking with recovery passphrase…'
          : source === 'local'
            ? 'Confirm your wallet in MetaMask to view…'
            : 'Confirm your wallet in MetaMask (loaded from Arweave)…',
      )

      let result

      if (recoveryPassphrase) {
        result = await decryptWithPassphrase(payload, recoveryPassphrase)
      } else if (payload.litCiphertext && forceWalletFallback === false) {
        try {
          result = await decryptWithLit(payload)
        } catch {
          result = await decryptWithWallet(payload)
        }
      } else {
        result = await decryptWithWallet(payload)
      }

      const { decryptedBytes, meta } = result
      const fileName = meta?.originalFileName || payload.originalFileName
      const fileType = meta?.originalFileType || payload.originalFileType

      assertSafeDecryptedContent(decryptedBytes, fileName, fileType)

      const safeType = safeBlobMimeType(fileType)
      const blob = new Blob([decryptedBytes], { type: safeType })
      const url = URL.createObjectURL(blob)

      setStep('')
      return {
        url,
        fileName: sanitizeFileName(fileName),
        fileType: safeType,
        walletAddress: payload.encryptedByWallet || payload.walletAddress,
        cleanup: () => URL.revokeObjectURL(url),
      }
    } catch (error) {
      setStep('')
      console.error('Vault retrieve failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function inspectRecoveryMethods(arweaveId) {
    setLoading(true)
    try {
      setStep('Inspecting encrypted archive…')
      const { bytes } = await loadVaultBundleBytes(arweaveId)
      const payload = assertRecoveryTestCompatible(parseVaultBytes(bytes))
      return {
        archiveId: arweaveId,
        methods: availableRecoveryMethods(payload, address),
        bundleVersion: payload.bundleVersion,
        recoverySpecVersion: payload.recoverySpecVersion,
      }
    } finally {
      setStep('')
      setLoading(false)
    }
  }

  async function testRecovery(arweaveId, { method, passphrase = '' } = {}) {
    setLoading(true)
    let decrypted
    try {
      setStep('Loading encrypted archive…')
      const { bytes } = await loadVaultBundleBytes(arweaveId)
      const payload = assertRecoveryTestCompatible(parseVaultBytes(bytes))
      let record

      if (method === 'passphrase') {
        setStep('Testing passphrase recovery locally…')
        record = await testPassphraseRecovery(payload, passphrase, { archiveId: arweaveId })
      } else if (method === 'owner-wallet' || method === 'backup-wallet') {
        setStep('Confirm the recovery test in your wallet…')
        decrypted = await decryptWithWallet(payload)
        await verifyExactRecovery(payload, decrypted)
        const owner = (payload.encryptedByWallet || payload.walletAddress || '').toLowerCase()
        const resolvedMethod = owner === address?.toLowerCase() ? 'owner-wallet' : 'backup-wallet'
        if (method !== resolvedMethod) throw new Error('RECOVERY_UNAVAILABLE')
        record = createRecoveryTestRecord(payload, { archiveId: arweaveId, method: resolvedMethod })
      } else {
        throw new Error('RECOVERY_UNAVAILABLE')
      }

      saveRecoveryTestRecord(record)
      return record
    } finally {
      decrypted?.decryptedBytes?.fill(0)
      setStep('')
      setLoading(false)
    }
  }

  async function deleteVaultFile(fileId) {
    setLoading(true)
    try {
      if (!isConnected || !address) throw new Error('WALLET_NOT_CONNECTED')
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.VaultRegistry,
        abi: VaultRegistryABI.abi,
        functionName: 'deleteFile',
        args: [fileId],
        account: address,
        chain: baseSepolia,
      })
      await requireSuccessfulReceipt(waitForTransactionReceipt, wagmiConfig, { hash })
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  return {
    storeFile,
    authorizeBackupWallet,
    retrieveAndDecryptFile,
    inspectRecoveryMethods,
    testRecovery,
    deleteVaultFile,
    getStorageEstimate,
    loading,
    step,
    uploadProgress,
    SignPromptModal,
  }
}
