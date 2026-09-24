import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const hashes = JSON.parse(await readFile(resolve(ROOT, 'research/fixtures/expected/hashes.json'), 'utf8'))
const result = {
  experiment: 'E05',
  description: 'Original Arweave gateway unavailable',
  timestamp: new Date().toISOString(),
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  gitDirty: true,
  fixture: 'research/fixtures/archives/passphrase-v1.arkive',
  fixtureArchiveSha256: hashes.archiveSha256,
  ciphertextSha256: hashes.ciphertextSha256,
  transactionStorageIdentifier: null,
  removedDependencies: ['primary_arweave_gateway'],
  availableDependencies: [],
  expectedOutcome: 'RECOVERY_SUCCESS',
  actualOutcome: 'ENVIRONMENT_UNAVAILABLE',
  errorClassification: 'The committed synthetic fixture has no Arweave transaction ID; creating one may require a funded upload and was not authorized.',
  gatewayA: null,
  gatewayB: null,
  gatewayBIndependentOperatorEstablished: false,
  retrievedArchiveASha256: null,
  retrievedArchiveBSha256: null,
  expectedPlaintextSha256: hashes.plaintextSha256,
  recoveredPlaintextSha256: null,
  exactByteMatch: null,
  externalEndpointsContacted: [],
  durationMs: 0,
  result: 'SKIPPED',
}
await writeFile(resolve(ROOT, 'research/results/latest/E05.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
