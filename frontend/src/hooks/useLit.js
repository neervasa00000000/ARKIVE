import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { getLitClient, buildAccessConditions } from '../config/lit'

export function useLit() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [encrypting, setEncrypting] = useState(false)
  const [decrypting, setDecrypting] = useState(false)

  async function encryptFile(file) {
    if (!address) throw new Error('WALLET_NOT_CONNECTED')
    setEncrypting(true)
    try {
      const client = await getLitClient()
      const accessControlConditions = buildAccessConditions(address)

      const fileArrayBuffer = await file.arrayBuffer()
      const fileBytes = new Uint8Array(fileArrayBuffer)

      const { ciphertext, dataToEncryptHash } = await client.encrypt({
        accessControlConditions,
        dataToEncrypt: fileBytes,
      })

      return {
        ciphertext,
        dataToEncryptHash,
        accessControlConditions,
        originalFileName: file.name,
        originalFileType: file.type,
        originalFileSize: file.size,
      }
    } finally {
      setEncrypting(false)
    }
  }

  async function decryptFile(encryptedData, accessControlConditions) {
    setDecrypting(true)
    try {
      const client = await getLitClient()

      const sessionSigs = await client.getSessionSigs({
        chain: 'baseSepolia',
        expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        resourceAbilityRequests: [
          {
            resource: { resourcePrefix: 'lit-accesscontrol://*' },
            ability: 'access-control-condition-decryption',
          },
        ],
      })

      const decryptedBytes = await client.decrypt({
        accessControlConditions,
        ciphertext: encryptedData.ciphertext,
        dataToEncryptHash: encryptedData.dataToEncryptHash,
        sessionSigs,
        chain: 'baseSepolia',
      })

      return decryptedBytes

    } finally {
      setDecrypting(false)
    }
  }

  return { encryptFile, decryptFile, encrypting, decrypting }
}
