// frontend/src/hooks/useVault.js
import { useState } from 'react'
import { useAccount, useWalletClient, useWriteContract, useChainId } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { keccak256, toBytes } from 'viem'
import { wagmiConfig } from '../config/wagmi'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import VaultRegistryABI from '../contracts/VaultRegistry.json'
import { getLitClient, buildAccessConditions } from '../config/lit'

const ZERO = '0x0000000000000000000000000000000000000000'

const DERIVATION_MESSAGE =
  'ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT'

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

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
}

async function deriveKeyFromWallet(walletClient, address) {
  const signature = await walletClient.signMessage({
    account: address,
    message: DERIVATION_MESSAGE,
  })

  const derivedKeyBytes = toBytes(keccak256(toBytes(signature)))

  return crypto.subtle.importKey(
    'raw',
    derivedKeyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function uploadToArweave(data, contentType = 'application/json') {
  let bytes
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data)
  } else {
    bytes = data
  }

  const { TurboFactory } = await import('@ardrive/turbo-sdk')
  const jwk = JSON.parse(import.meta.env.VITE_ARWEAVE_KEY || '{}')
  if (!jwk.kty && !jwk.n) {
    throw new Error('ARWEAVE_NOT_CONFIGURED')
  }

  const turbo = TurboFactory.authenticated({ privateKey: jwk })

  const response = await turbo.uploadFile({
    fileStreamFactory: () => bytes,
    fileSizeFactory: () => bytes.length,
    dataItemOpts: {
      tags: [
        { name: 'Content-Type', value: contentType },
        { name: 'App-Name', value: 'ARKIVE' },
        { name: 'App-Version', value: '1.0.0' },
        { name: 'Encryption', value: 'dual-AES256GCM-Lit-WalletDerived' },
      ],
    },
  })

  return response.id
}

export function useVault() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')

  async function storeFile(file) {
    setLoading(true)
    try {
      if (!isConnected || !address || !walletClient) {
        throw new Error('WALLET_NOT_CONNECTED')
      }
      if (chainId !== 84532) throw new Error('WRONG_NETWORK')
      if (CONTRACT_ADDRESSES.VaultRegistry === ZERO) {
        throw new Error('CONTRACTS_NOT_DEPLOYED')
      }

      setStep('Reading file...')
      const fileBytes = new Uint8Array(await file.arrayBuffer())

      setStep('Generating encryption key...')
      const fileAesKey = await generateAesKey()
      const rawFileAesKey = await exportRawKey(fileAesKey)

      setStep('Encrypting file...')
      const { encrypted: encryptedFile, iv: fileIv } = await aesEncrypt(fileAesKey, fileBytes)

      setStep('Securing with Lit Protocol...')
      let litCiphertext = null
      let litDataToEncryptHash = null
      let litAccessConditions = null

      try {
        const litClient = await getLitClient()
        litAccessConditions = buildAccessConditions(address)
        const litResult = await litClient.encrypt({
          accessControlConditions: litAccessConditions,
          dataToEncrypt: rawFileAesKey,
        })
        litCiphertext = litResult.ciphertext
        litDataToEncryptHash = litResult.dataToEncryptHash
      } catch (litError) {
        console.warn('Lit Protocol encryption failed, continuing with wallet fallback only:', litError)
      }

      setStep('Creating permanent fallback key...')
      const derivedKey = await deriveKeyFromWallet(walletClient, address)
      const { encrypted: walletEncryptedAesKey, iv: walletKeyIv } = await aesEncrypt(
        derivedKey,
        rawFileAesKey,
      )

      const arweavePayload = JSON.stringify({
        version: 'v2',
        schema: 'ARKIVE_DUAL_ENCRYPTED_VAULT_FILE',

        encryptedFile: toBase64(encryptedFile),
        encryptedFileIv: toBase64(fileIv),

        litCiphertext,
        litDataToEncryptHash,
        litAccessConditions,
        litChain: 'baseSepolia',

        walletEncryptedAesKey: toBase64(walletEncryptedAesKey),
        walletEncryptedAesKeyIv: toBase64(walletKeyIv),
        walletAddress: address.toLowerCase(),
        derivationMessage: DERIVATION_MESSAGE,

        recoveryInstructions: {
          step1: 'Go to https://arweave.net/[ARKIVE-APP-TX-ID] or arkive.ar',
          step2: 'Connect the wallet whose address matches walletAddress above',
          step3: 'Navigate to /recover for the full recovery guide',
          step4: 'For manual recovery: sign the derivationMessage above, keccak256 hash the signature, use as AES-256-GCM key to decrypt walletEncryptedAesKey, use result to decrypt encryptedFile',
        },

        originalFileName: file.name,
        originalFileType: file.type,
        originalFileSize: file.size,
        encryptedAt: Date.now(),
        encryptedByWallet: address.toLowerCase(),
      })

      setStep('Uploading to Arweave...')
      const arweaveId = await uploadToArweave(arweavePayload, 'application/json')

      const fileType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type === 'application/pdf'
            ? 'document'
            : 'other'

      setStep('Registering on blockchain...')
      const conditionsHash = litAccessConditions
        ? JSON.stringify(litAccessConditions)
        : `wallet:${address.toLowerCase()}`

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.VaultRegistry,
        abi: VaultRegistryABI.abi,
        functionName: 'storeFile',
        args: [arweaveId, file.name, fileType, conditionsHash],
      })

      await waitForTransactionReceipt(wagmiConfig, { hash })

      setStep('')
      return { success: true, arweaveId }
    } catch (error) {
      setStep('')
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
    const fileIv = fromBase64(payload.encryptedFileIv)
    const encryptedFileBytes = fromBase64(payload.encryptedFile)
    const decryptedBytes = await aesDecrypt(fileAesKey, encryptedFileBytes, fileIv)
    return new Uint8Array(decryptedBytes)
  }

  async function decryptWithWallet(payload) {
    if (!payload.walletEncryptedAesKey) throw new Error('No wallet encryption data in payload')
    if (!walletClient || !address) throw new Error('WALLET_NOT_CONNECTED')

    const derivedKey = await deriveKeyFromWallet(walletClient, address)

    const walletKeyIv = fromBase64(payload.walletEncryptedAesKeyIv)
    const walletEncryptedAesKeyBytes = fromBase64(payload.walletEncryptedAesKey)
    const rawAesKeyBuffer = await aesDecrypt(derivedKey, walletEncryptedAesKeyBytes, walletKeyIv)

    const fileAesKey = await importRawKey(new Uint8Array(rawAesKeyBuffer))
    const fileIv = fromBase64(payload.encryptedFileIv)
    const encryptedFileBytes = fromBase64(payload.encryptedFile)
    const decryptedBytes = await aesDecrypt(fileAesKey, encryptedFileBytes, fileIv)

    return new Uint8Array(decryptedBytes)
  }

  async function retrieveAndDecryptFile(arweaveId, forceWalletFallback = false) {
    setLoading(true)
    try {
      setStep('Fetching from Arweave...')
      const response = await fetch(`https://arweave.net/${arweaveId}`)
      if (!response.ok) throw new Error('Failed to fetch from Arweave')
      const payload = await response.json()

      if (payload.schema !== 'ARKIVE_DUAL_ENCRYPTED_VAULT_FILE') {
        throw new Error('Legacy file format. Use wallet fallback path.')
      }

      let decryptedBytes

      if (!forceWalletFallback) {
        try {
          setStep('Decrypting with Lit Protocol...')
          decryptedBytes = await decryptWithLit(payload)
        } catch (litError) {
          console.warn('Lit Protocol decryption failed, trying wallet fallback:', litError)
          setStep('Lit Protocol unavailable. Using wallet fallback...')
          decryptedBytes = await decryptWithWallet(payload)
        }
      } else {
        setStep('Decrypting with wallet signature...')
        decryptedBytes = await decryptWithWallet(payload)
      }

      const blob = new Blob([decryptedBytes], { type: payload.originalFileType })
      const url = URL.createObjectURL(blob)

      setStep('')
      return {
        url,
        fileName: payload.originalFileName,
        fileType: payload.originalFileType,
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

  return {
    storeFile,
    retrieveAndDecryptFile,
    loading,
    step,
  }
}
