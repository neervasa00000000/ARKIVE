// Sends only synthetic bytes with a throwaway wallet; never funds an account.
import { TurboFactory, ExistingBalanceFunding } from '@ardrive/turbo-sdk'
import { randomBytes } from 'node:crypto'
import { generateAesKey, exportRawKey, aesEncrypt, encryptVaultMetadata, wrapFileKeyForPassphrase, sha256Hex } from '../src/lib/vaultKeyWrap.js'
import { encodeVaultBundle, parseVaultBytes, VAULT_SCHEMA_V3 } from '../src/lib/vaultBundle.js'
import { decryptVaultWithPassphrase } from '../src/lib/vaultCrypto.js'
import { bytesToBase64 } from '../src/lib/security.js'
const original = Buffer.alloc(7 * 1024, 65)
const key = await generateAesKey()
const rawKey = await exportRawKey(key)
const sealed = await aesEncrypt(key, original)
const metadata = await encryptVaultMetadata(key, { originalFileName: 'synthetic.txt', originalFileType: 'text/plain', originalContentHash: await sha256Hex(original) })
const phrase = 'synthetic test only recovery phrase'
const header = { schema: VAULT_SCHEMA_V3, contentHash: await sha256Hex(sealed.encrypted), encryptedFileIv: bytesToBase64(sealed.iv), ...metadata, recoveryWrap: await wrapFileKeyForPassphrase(rawKey, phrase) }
rawKey.fill(0)
const data = Buffer.from(encodeVaultBundle(header, sealed.encrypted))
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
const decrypted = await decryptVaultWithPassphrase(parseVaultBytes(new Uint8Array(fetched)), phrase)
if (!Buffer.from(decrypted.decryptedBytes).equals(original)) throw new Error('Decrypted bytes differ')
console.log('Encrypted, uploaded, retrieved and decrypted all 7168 original bytes; exact match.')
