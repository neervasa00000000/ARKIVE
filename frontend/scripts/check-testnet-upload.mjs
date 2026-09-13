// Sends only synthetic bytes with a throwaway wallet; never funds an account.
import { TurboFactory, ExistingBalanceFunding } from '@ardrive/turbo-sdk'
import { randomBytes } from 'node:crypto'
const data = Buffer.alloc(7 * 1024, 65)
const turbo = TurboFactory.authenticated({
  privateKey: '0x' + randomBytes(32).toString('hex'), token: 'base-eth',
  gatewayUrl: 'https://sepolia.base.org',
  paymentServiceConfig: { url: 'https://payment.services.ar-io.dev' },
  uploadServiceConfig: { url: 'https://upload.services.ar-io.dev' },
})
const result = await turbo.uploadFile({
  fileStreamFactory: () => data, fileSizeFactory: () => data.length,
  fundingMode: new ExistingBalanceFunding(),
  dataItemOpts: { tags: [{ name: 'Content-Type', value: 'application/octet-stream' }, { name: 'App-Name', value: 'ARKIVE-Test' }] },
})
console.log(JSON.stringify({ uploadedBytes: data.length, id: result.id }))
const response = await fetch(`https://ar-io.dev/${result.id}`, { signal: AbortSignal.timeout(30000) })
if (!response.ok) throw new Error(`Retrieval failed: ${response.status}`)
const fetched = Buffer.from(await response.arrayBuffer())
if (!fetched.equals(data)) throw new Error('Retrieved bytes differ')
console.log('Retrieved all 7168 bytes; exact match.')
