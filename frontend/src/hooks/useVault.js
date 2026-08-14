// frontend/src/hooks/useVault.js
import { useState } from 'react'
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
  validateSealFile,
  validateSealFileDeep,
  safeBlobMimeType,
  assertSafeDecryptedContent,
  validateArweaveTxId,
} from '../lib/security'
import {
  uploadBytesViaUserWallet,
  estimateUploadCost,
  ensureStorageCreditsReady,
  estimateBundleByteCount,
  warmTurboWalletLink,
} from '../lib/turboUpload'
import { useTurboSignPrompt } from './useTurboSignPrompt'
import { optimizeImageBytes } from '../lib/imageOptimize'
import { encodeVaultBundle, VAULT_SCHEMA_V3, parseVaultBytes } from '../lib/vaultBundle'
import { loadVaultBundleBytes, rememberVaultBundle } from '../lib/vaultLocal'
import {
  DERIVATION_VERSION_EIP712,
  buildEip712Domain,
  deriveKeyForPayload,
  deriveKeyFromWalletV2,
} from '../lib/vaultDerivation'

async function generateAesKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

async function exportRawKey(key) {
  const buf = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(buf)
}

async function importRawKey(bytes) {
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function aesEncrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { encrypted: new Uint8Array(encrypted), iv }
}

async function aesDecrypt(key, encryptedBytes, iv) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBytes)
}

const ZERO = '0x0000000000000000000000000000000000000000'

export function useVault() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const { onSignPrompt, SignPromptModal } = useTurboSignPrompt()
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

  async function storeFile(file) {
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

      await validateSealFileDeep(file)

      setStep('Open MetaMask — approve vault key signature…')
      await warmTurboWalletLink(walletClient, setStep)

      setStep('Encrypting…')
      const [optimizedFile, derivedKey, fileAesKey] = await Promise.all([
        file.arrayBuffer().then((b) => optimizeImageBytes({ bytes: new Uint8Array(b), mimeType: file.type })),
        deriveKeyFromWalletV2(walletClient, address),
        generateAesKey(),
      ])
      const fileBytes = optimizedFile.bytes
      const rawFileAesKey = await exportRawKey(fileAesKey)
      const { encrypted: encryptedFile, iv: fileIv } = await aesEncrypt(fileAesKey, fileBytes)

      const { encrypted: walletEncryptedAesKey, iv: walletKeyIv } = await aesEncrypt(
        derivedKey,
        rawFileAesKey,
      )

      const vaultHeader = {
        version: 'v3',
        schema: VAULT_SCHEMA_V3,

        encryptedFileIv: bytesToBase64(fileIv),

        litCiphertext: null,
        litDataToEncryptHash: null,
        litAccessConditions: null,
        litChain: 'baseSepolia',

        walletEncryptedAesKey: bytesToBase64(walletEncryptedAesKey),
        walletEncryptedAesKeyIv: bytesToBase64(walletKeyIv),
        walletAddress: address.toLowerCase(),
        derivationVersion: DERIVATION_VERSION_EIP712,
        eip712Domain: buildEip712Domain(),

        recoveryInstructions: {
          step1: 'Go to https://arweave.net/[ARKIVE-APP-TX-ID] or arkive.ar',
          step2: 'Connect the wallet whose address matches walletAddress above',
          step3: 'Navigate to /recover for the full recovery guide',
          step4: 'Wallet fallback: sign EIP-712 VaultKeyDerivation (v2) — see /recover',
        },

        originalFileName: sanitizeFileName(file.name),
        originalFileType: file.type,
        originalFileSize: fileBytes.length,
        encryptedAt: Date.now(),
        encryptedByWallet: address.toLowerCase(),
      }

      const arweaveBundle = encodeVaultBundle(vaultHeader, encryptedFile)
      const fastUpload = arweaveBundle.length <= 512 * 1024
      const uploadOpts = { fast: fastUpload }

      setStep('Checking storage (approve ETH in MetaMask if needed)…')
      const fundingBytes = estimateBundleByteCount(arweaveBundle.length)
      const creditPrep = await ensureStorageCreditsReady(
        walletClient,
        fundingBytes,
        setStep,
        uploadOpts,
      )

      setStep('Step 1 of 2 — uploading to Arweave (signatures + ETH if needed)…')
      arweaveId = await uploadBytesViaUserWallet(walletClient, arweaveBundle, {
        contentType: 'application/octet-stream',
        cacheBytes: arweaveBundle.length <= 12 * 1024 * 1024 ? arweaveBundle : null,
        creditsReady: true,
        preparedFunding: creditPrep.preparedFunding,
        byteCount: fundingBytes,
        extraTags: [{ name: 'Encryption', value: 'dual-AES256GCM-Lit-WalletDerived' }],
        onStep: setStep,
        onProgress: setUploadProgress,
        onSignPrompt,
        ...uploadOpts,
      })

      arweaveId = validateArweaveTxId(arweaveId)

      const fileType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type === 'application/pdf'
            ? 'document'
            : 'other'

      setStep('Step 2 of 2 — approve on-chain vault record in MetaMask')
      const conditionsHash = `wallet:${address.toLowerCase()}`

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.VaultRegistry,
        abi: VaultRegistryABI.abi,
        functionName: 'storeFile',
        args: [arweaveId, sanitizeFileName(file.name), fileType, conditionsHash],
        account: address,
        chain: baseSepolia,
      })

      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: baseSepolia.id })

      void rememberVaultBundle(arweaveId, arweaveBundle)

      setStep('')
      setUploadProgress(0)
      return {
        success: true,
        arweaveId,
        fileName: sanitizeFileName(file.name),
        fileType: file.type,
      }
    } catch (error) {
      setStep('')
      setUploadProgress(0)
      const msg = error?.message || String(error)
      if (
        (msg.includes('user rejected') || msg.includes('User rejected')) &&
        typeof arweaveId === 'string' &&
        arweaveId.length > 20
      ) {
        throw new Error(
          `CHAIN_REGISTER_FAILED:${arweaveId}:File is on Arweave but on-chain registration was cancelled. Click Encrypt & store again — you should not pay for storage again.`,
        )
      }
      console.error('Vault store failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

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
    const fileIv = base64ToBytes(payload.encryptedFileIv)
    const encryptedFileBytes =
      payload.encryptedFileBytes instanceof Uint8Array
        ? payload.encryptedFileBytes
        : base64ToBytes(payload.encryptedFile)
    const decryptedBytes = await aesDecrypt(fileAesKey, encryptedFileBytes, fileIv)
    return new Uint8Array(decryptedBytes)
  }

  async function decryptWithWallet(payload) {
    if (!payload.walletEncryptedAesKey) throw new Error('No wallet encryption data in payload')
    if (!walletClient || !address) throw new Error('WALLET_NOT_CONNECTED')

    assertVaultPayloadOwnership(payload, address)

    const derivedKey = await deriveKeyForPayload(walletClient, address, payload)

    const walletKeyIv = base64ToBytes(payload.walletEncryptedAesKeyIv)
    const walletEncryptedAesKeyBytes = base64ToBytes(payload.walletEncryptedAesKey)
    const rawAesKeyBuffer = await aesDecrypt(derivedKey, walletEncryptedAesKeyBytes, walletKeyIv)

    const fileAesKey = await importRawKey(new Uint8Array(rawAesKeyBuffer))
    const fileIv = base64ToBytes(payload.encryptedFileIv)
    const encryptedFileBytes =
      payload.encryptedFileBytes instanceof Uint8Array
        ? payload.encryptedFileBytes
        : base64ToBytes(payload.encryptedFile)
    const decryptedBytes = await aesDecrypt(fileAesKey, encryptedFileBytes, fileIv)

    return new Uint8Array(decryptedBytes)
  }

  async function retrieveAndDecryptFile(arweaveId, _forceWalletFallback = false) {
    setLoading(true)
    try {
      if (!address || !walletClient) throw new Error('WALLET_NOT_CONNECTED')

      setStep('Loading encrypted bundle…')
      const { bytes, source } = await loadVaultBundleBytes(arweaveId)

      const payload = assertVaultPayloadOwnership(parseVaultBytes(bytes), address)

      setStep(
        source === 'local'
          ? 'Confirm your wallet in MetaMask to view…'
          : 'Confirm your wallet in MetaMask (loaded from Arweave)…',
      )

      let decryptedBytes

      if (payload.litCiphertext && _forceWalletFallback === false) {
        try {
          decryptedBytes = await decryptWithLit(payload)
        } catch {
          decryptedBytes = await decryptWithWallet(payload)
        }
      } else {
        decryptedBytes = await decryptWithWallet(payload)
      }

      assertSafeDecryptedContent(decryptedBytes, payload.originalFileName, payload.originalFileType)

      const safeType = safeBlobMimeType(payload.originalFileType)
      const blob = new Blob([decryptedBytes], { type: safeType })
      const url = URL.createObjectURL(blob)

      setStep('')
      return {
        url,
        fileName: sanitizeFileName(payload.originalFileName),
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
      await waitForTransactionReceipt(wagmiConfig, { hash })
      return { success: true }
    } finally {
      setLoading(false)
    }
  }

  return {
    storeFile,
    retrieveAndDecryptFile,
    deleteVaultFile,
    getStorageEstimate,
    loading,
    step,
    uploadProgress,
    SignPromptModal,
  }
}
