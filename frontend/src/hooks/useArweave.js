import { useState } from 'react'

export function useArweave() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function uploadToArweave(data, contentType = 'application/json') {
    setUploading(true)
    setProgress(0)

    try {
      const { TurboFactory } = await import('@ardrive/turbo-sdk')
      const jwk = JSON.parse(import.meta.env.VITE_ARWEAVE_KEY || '{}')
      if (!jwk.kty && !jwk.n) {
        throw new Error('ARWEAVE_NOT_CONFIGURED')
      }

      const turbo = TurboFactory.authenticated({ privateKey: jwk })

      let fileData
      if (data instanceof File || data instanceof Blob) {
        fileData = new Uint8Array(await data.arrayBuffer())
      } else if (typeof data === 'string') {
        fileData = new TextEncoder().encode(data)
      } else {
        fileData = new Uint8Array(data)
      }

      setProgress(30)

      const response = await turbo.uploadFile({
        fileStreamFactory: () => fileData,
        fileSizeFactory: () => fileData.length,
        dataItemOpts: {
          tags: [
            { name: 'Content-Type', value: contentType },
            { name: 'App-Name', value: 'ARKIVE' },
            { name: 'App-Version', value: '0.1.0' },
          ],
        },
      })

      setProgress(100)
      return response.id // Arweave transaction ID

    } catch (error) {
      console.error('Arweave upload failed:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  async function fetchFromArweave(txId) {
    const response = await fetch(`https://arweave.net/${txId}`)
    if (!response.ok) throw new Error('Failed to fetch from Arweave')
    return response
  }

  return { uploadToArweave, fetchFromArweave, uploading, progress }
}
