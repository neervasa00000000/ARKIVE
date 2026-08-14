/**
 * Compare Turbo configs — does upload land on Arweave gateways?
 * Run: node scripts/turbo-upload-probe.mjs
 */
import {
  TurboFactory,
  ExistingBalanceFunding,
  defaultTurboConfiguration,
} from '@ardrive/turbo-sdk'
import { EthereumSigner } from '@dha-team/arbundles'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pk = readFileSync(resolve(__dirname, '../../contracts/.env'), 'utf8')
  .match(/DEPLOYER_PRIVATE_KEY=(.+)/)?.[1]?.trim()

const GATEWAYS = [
  (id) => `https://turbo-gateway.ar.io/${id}`,
  (id) => `https://turbo-gateway.com/${id}`,
  (id) => `https://arweave.net/${id}`,
]

async function probe(id, maxRounds = 24, delayMs = 5000) {
  for (let r = 1; r <= maxRounds; r++) {
    for (const g of GATEWAYS) {
      try {
        const res = await fetch(g(id), { redirect: 'follow' })
        if (res.ok) {
          const buf = await res.arrayBuffer()
          if (buf.byteLength > 0) return { round: r, url: g(id), size: buf.byteLength }
        }
      } catch {}
    }
    process.stdout.write(`  probe ${r}/${maxRounds}\r`)
    if (r < maxRounds) await new Promise((x) => setTimeout(x, delayMs))
  }
  return null
}

async function testConfig(name, config) {
  console.log(`\n=== ${name} ===`)
  const wallet = new EthereumSigner(pk)
  const turbo = TurboFactory.authenticated({
    ...config,
    signer: wallet,
    token: 'base-eth',
    gatewayUrl: 'https://sepolia.base.org',
  })
  const addr = await turbo.signer.getNativeAddress()
  const bal = await turbo.getBalance(addr)
  console.log('balance winc', bal.effectiveBalance)

  const payload = Buffer.from(`arkive-probe-${name}-${Date.now()}`)
  let res
  try {
    res = await turbo.uploadFile({
      fileStreamFactory: () => payload,
      fileSizeFactory: () => payload.length,
      fundingMode: new ExistingBalanceFunding(),
      dataItemOpts: { tags: [{ name: 'Content-Type', value: 'text/plain' }] },
    })
  } catch (e) {
    console.log('UPLOAD FAILED', e.message)
    return null
  }
  console.log('upload id', res.id)
  const hit = await probe(res.id)
  console.log(hit ? `GATEWAY OK ${hit.url} ${hit.size}b round ${hit.round}` : 'GATEWAY NEVER FOUND')
  return { id: res.id, hit }
}

await testConfig('production-turbo', defaultTurboConfiguration)
