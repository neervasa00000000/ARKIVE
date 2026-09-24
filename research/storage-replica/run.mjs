import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE = resolve(ROOT, 'research/fixtures/archives/passphrase-v1.arkive')
const HASHES = JSON.parse(await readFile(resolve(ROOT, 'research/fixtures/expected/hashes.json'), 'utf8'))
const METADATA = JSON.parse(await readFile(resolve(ROOT, 'research/fixtures/metadata.json'), 'utf8'))
const RESULT = resolve(ROOT, 'research/results/latest/E11.json')
const DENY_NETWORK = resolve(ROOT, 'research/harness/deny-network.mjs')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const work = await mkdtemp(resolve(tmpdir(), 'arkive-e11-'))
const primary = resolve(work, 'primary')
const replica = resolve(work, 'independent-replica')
const fresh = resolve(work, 'fresh-recovery-environment')
const tool = resolve(fresh, 'arkive-recover')
const output = resolve(fresh, 'output')
const endpointLog = resolve(fresh, 'endpoints.log')
const started = performance.now()

try {
  await Promise.all([mkdir(primary), mkdir(replica), mkdir(fresh)])
  await mkdir(output)
  const original = await readFile(FIXTURE)
  await Promise.all([
    writeFile(resolve(primary, 'archive.arkive'), original),
    writeFile(resolve(replica, 'archive.arkive'), original),
  ])
  const primaryHash = sha256(await readFile(resolve(primary, 'archive.arkive')))
  const replicaHash = sha256(await readFile(resolve(replica, 'archive.arkive')))

  await rm(primary, { recursive: true, force: true })
  await cp(resolve(ROOT, 'tools/arkive-recover'), tool, { recursive: true })
  const recoveredInput = resolve(fresh, 'archive-from-replica.arkive')
  await cp(resolve(replica, 'archive.arkive'), recoveredInput)

  const child = spawn(process.execPath, [resolve(tool, 'cli.mjs'), 'recover', recoveredInput, '--output', output, '--json'], {
    cwd: fresh,
    env: {
      PATH: process.env.PATH,
      HOME: fresh,
      TMPDIR: fresh,
      ARKIVE_RECOVERY_PASSPHRASE: METADATA.testOnlyPassphrase,
      ARKIVE_ENDPOINT_LOG: endpointLog,
      NODE_OPTIONS: `--import=${pathToFileURL(DENY_NETWORK).href}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''; let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const exitCode = await new Promise((done) => child.on('close', done))
  let recoveredHash = null
  if (exitCode === 0) {
    const parsed = JSON.parse(stdout)
    recoveredHash = sha256(await readFile(parsed.outputPath))
  }
  let endpoints = []
  try { endpoints = (await readFile(endpointLog, 'utf8')).split('\n').filter(Boolean) } catch {}
  const passed = primaryHash === HASHES.archiveSha256 &&
    replicaHash === HASHES.archiveSha256 &&
    sha256(await readFile(recoveredInput)) === HASHES.archiveSha256 &&
    recoveredHash === HASHES.plaintextSha256 && exitCode === 0 && endpoints.length === 0
  const result = {
    experiment: 'E11',
    stage: 'E11-A',
    description: 'Primary storage unavailable with an independent local replica',
    timestamp: new Date().toISOString(),
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    gitDirty: true,
    fixture: 'research/fixtures/archives/passphrase-v1.arkive',
    fixtureArchiveSha256: HASHES.archiveSha256,
    removedDependencies: ['primary_storage_provider', 'network'],
    availableDependencies: ['independent_local_replica', 'node_runtime', 'arkive_recover', 'test_credential'],
    expectedOutcome: 'RECOVERY_SUCCESS_FROM_REPLICA',
    actualOutcome: exitCode === 0 ? 'RECOVERY_SUCCESS' : 'RECOVERY_REJECTED',
    errorClassification: exitCode === 0 ? null : stderr.trim() || 'implementation failure',
    primaryStorageAvailable: false,
    replicaAvailable: true,
    accessedLocations: ['independent-replica/archive.arkive', 'fresh-recovery-environment/archive-from-replica.arkive'],
    primaryArchiveSha256BeforeRemoval: primaryHash,
    replicaArchiveSha256: replicaHash,
    expectedPlaintextSha256: HASHES.plaintextSha256,
    recoveredPlaintextSha256: recoveredHash,
    exactByteMatch: recoveredHash === HASHES.plaintextSha256,
    externalEndpointsContacted: [...new Set(endpoints)],
    durationMs: Math.round(performance.now() - started),
    claimBoundary: "ARKIVE's encrypted archive object can be recovered from a storage location independent of its original storage path.",
    excludedClaim: 'This does not validate cross-network blockchain permanence or E11-B.',
    result: passed ? 'PASS' : 'FAIL',
  }
  await writeFile(RESULT, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  if (!passed) process.exitCode = 1
} finally {
  await rm(work, { recursive: true, force: true })
}
