import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { parseArchive } from '../../tools/arkive-recover/core.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const MATRIX_PATH = resolve(ROOT, 'research/experiments/experiment-matrix.json')
const ARCHIVE_PATH = resolve(ROOT, 'research/fixtures/archives/passphrase-v1.arkive')
const EXPECTED_PATH = resolve(ROOT, 'research/fixtures/expected/hashes.json')
const METADATA_PATH = resolve(ROOT, 'research/fixtures/metadata.json')
const CLI_PATH = resolve(ROOT, 'tools/arkive-recover/cli.mjs')
const DENY_NETWORK_PATH = resolve(ROOT, 'research/harness/deny-network.mjs')
const RESULTS_ROOT = resolve(ROOT, 'research/results')

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function runProcess({ archive, passphrase, home, networkDisabled, endpointLog }) {
  const outputDir = resolve(home, 'output')
  const env = {
    PATH: process.env.PATH,
    HOME: home,
    TMPDIR: resolve(home, 'tmp'),
    XDG_CONFIG_HOME: resolve(home, 'xdg-config'),
    XDG_CACHE_HOME: resolve(home, 'xdg-cache'),
    ARKIVE_RECOVERY_PASSPHRASE: passphrase,
    ARKIVE_ENDPOINT_LOG: endpointLog,
    BASE_SEPOLIA_RPC_URL: 'http://127.0.0.1:1/unreachable',
  }
  if (networkDisabled) env.NODE_OPTIONS = `--import=${pathToFileURL(DENY_NETWORK_PATH).href}`
  await Promise.all([mkdir(env.TMPDIR, { recursive: true }), mkdir(outputDir, { recursive: true })])
  const started = performance.now()
  const child = spawn(process.execPath, [CLI_PATH, 'recover', archive, '--output', outputDir, '--json'], {
    cwd: home,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const exitCode = await new Promise((resolveExit) => child.on('close', resolveExit))
  return { exitCode, stdout, stderr, durationMs: Math.round(performance.now() - started) }
}

function corruptMetadata(archive) {
  const parsed = parseArchive(archive)
  const header = structuredClone(parsed.header)
  const encrypted = Buffer.from(header.encryptedMetadata, 'base64')
  encrypted[0] ^= 1
  header.encryptedMetadata = encrypted.toString('base64')
  const headerBytes = Buffer.from(JSON.stringify(header))
  const out = Buffer.alloc(9 + headerBytes.length + parsed.ciphertext.length)
  out.write('ARKV', 0)
  out[4] = 3
  out.writeUInt32BE(headerBytes.length, 5)
  headerBytes.copy(out, 9)
  parsed.ciphertext.copy(out, 9 + headerBytes.length)
  return out
}

async function endpoints(path) {
  try {
    return [...new Set((await readFile(path, 'utf8')).split('\n').filter(Boolean))]
  } catch {
    return []
  }
}

function reportMarkdown(results, commit, timestamp) {
  const rows = results.map((item) =>
    `| ${item.experiment} | ${item.removedDependencies.join(', ') || 'None'} | ${item.expectedOutcome} | ${item.actualOutcome} | ${item.exactByteMatch == null ? 'N/A' : item.exactByteMatch ? 'Yes' : 'No'} | ${item.result} |`,
  )
  return [
    '# ARKIVE Recovery Dependency Experiments',
    '',
    `Commit: \`${commit}\``,
    `Date: ${timestamp}`,
    '',
    '| Experiment | Dependency removed | Expected | Actual | Exact bytes | Result |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'PASS means the experiment actually produced its expected recovery or rejection outcome.',
    'NOT VALIDATED means the required experiment infrastructure does not yet exist.',
    '',
  ].join('\n')
}

const [matrix, expected, metadata, originalArchive] = await Promise.all([
  readFile(MATRIX_PATH, 'utf8').then(JSON.parse),
  readFile(EXPECTED_PATH, 'utf8').then(JSON.parse),
  readFile(METADATA_PATH, 'utf8').then(JSON.parse),
  readFile(ARCHIVE_PATH),
])
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
const gitDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim())
const timestamp = new Date().toISOString()
const runName = timestamp.replace(/[:.]/g, '-')
const runDir = resolve(RESULTS_ROOT, runName)
const latestDir = resolve(RESULTS_ROOT, 'latest')
await Promise.all([mkdir(runDir, { recursive: true }), rm(latestDir, { recursive: true, force: true })])
await mkdir(latestDir, { recursive: true })

const results = []
for (const experiment of matrix.experiments) {
  const base = {
    experiment: experiment.id,
    description: experiment.description,
    timestamp,
    gitCommit: commit,
    gitDirty,
    fixture: 'research/fixtures/archives/passphrase-v1.arkive',
    fixtureArchiveSha256: expected.archiveSha256,
    removedDependencies: experiment.removedDependencies,
    availableDependencies: ['local_archive', 'node_crypto', 'arkive_recover', experiment.id === 'E08' ? 'invalid_test_credential' : 'test_credential'],
    expectedOutcome: experiment.expectedOutcome,
    expectedPlaintextSha256: expected.plaintextSha256,
  }
  if (experiment.validationState === 'NOT VALIDATED') {
    results.push({
      ...base,
      actualOutcome: 'NOT_IMPLEMENTED',
      errorClassification: 'research infrastructure unavailable',
      recoveredPlaintextSha256: null,
      exactByteMatch: null,
      externalEndpointsContacted: [],
      durationMs: 0,
      result: 'NOT VALIDATED',
    })
    continue
  }

  const isolated = await mkdtemp(join(tmpdir(), `arkive-${experiment.id}-`))
  const archive = resolve(isolated, 'fixture.arkive')
  const endpointLog = resolve(isolated, 'endpoints.log')
  let bytes = Buffer.from(originalArchive)
  let passphrase = metadata.testOnlyPassphrase
  if (experiment.id === 'E08') passphrase = 'deliberately wrong synthetic credential'
  if (experiment.id === 'E09') bytes[bytes.length - 1] ^= 1
  if (experiment.id === 'E10') bytes = corruptMetadata(bytes)
  if (experiment.id === 'E12') bytes[4] = 4
  await writeFile(archive, bytes)
  try {
    const execution = await runProcess({
      archive,
      passphrase,
      home: isolated,
      networkDisabled: experiment.removedDependencies.includes('network'),
      endpointLog,
    })
    let recoveredPlaintextSha256 = null
    let exactByteMatch = null
    let actualOutcome
    let errorClassification = null
    if (execution.exitCode === 0) {
      const parsed = JSON.parse(execution.stdout)
      const recovered = await readFile(parsed.outputPath)
      recoveredPlaintextSha256 = sha256(recovered)
      exactByteMatch = recoveredPlaintextSha256 === expected.plaintextSha256
      actualOutcome = 'RECOVERY_SUCCESS'
    } else {
      actualOutcome = 'RECOVERY_REJECTED'
      errorClassification = execution.stderr.match(/ARKIVE_RECOVERY_ERROR ([A-Z0-9_]+)/)?.[1] || 'implementation failure'
    }
    const expectedSuccess = experiment.expectedOutcome === 'RECOVERY_SUCCESS'
    const passed = expectedSuccess
      ? actualOutcome === 'RECOVERY_SUCCESS' && exactByteMatch
      : actualOutcome === 'RECOVERY_REJECTED' && errorClassification === experiment.expectedError
    results.push({
      ...base,
      actualOutcome,
      errorClassification,
      recoveredPlaintextSha256,
      exactByteMatch,
      externalEndpointsContacted: await endpoints(endpointLog),
      durationMs: execution.durationMs,
      result: passed ? 'PASS' : 'FAIL',
    })
  } finally {
    await rm(isolated, { recursive: true, force: true })
  }
}

for (const result of results) {
  const json = `${JSON.stringify(result, null, 2)}\n`
  await Promise.all([
    writeFile(resolve(runDir, `${result.experiment}.json`), json),
    writeFile(resolve(latestDir, `${result.experiment}.json`), json),
  ])
}
const report = reportMarkdown(results, commit, timestamp)
await Promise.all([
  writeFile(resolve(runDir, 'REPORT.md'), report),
  writeFile(resolve(latestDir, 'REPORT.md'), report),
  writeFile(resolve(runDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`),
  writeFile(resolve(latestDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`),
])
console.log(report)
if (results.some((result) => result.result === 'FAIL')) process.exitCode = 1
