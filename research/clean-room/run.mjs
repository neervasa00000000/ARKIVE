import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')
const work = await mkdtemp(join(tmpdir(), 'arkive-clean-room-'))
const tool = resolve(work, 'arkive-recover')
const output = resolve(work, 'output')
const endpointLog = resolve(work, 'endpoints.log')
const fixture = resolve(work, 'fixture.arkive')
const expected = JSON.parse(await readFile(resolve(ROOT, 'research/fixtures/expected/hashes.json'), 'utf8'))
const metadata = JSON.parse(await readFile(resolve(ROOT, 'research/fixtures/metadata.json'), 'utf8'))
const timestamp = new Date().toISOString()

try {
  await Promise.all([
    cp(resolve(ROOT, 'tools/arkive-recover'), tool, { recursive: true }),
    cp(resolve(ROOT, 'research/fixtures/archives/passphrase-v1.arkive'), fixture),
    cp(resolve(ROOT, 'docs/RECOVERY-SPEC.md'), resolve(work, 'RECOVERY-SPEC.md')),
    cp(resolve(ROOT, 'research/harness/deny-network.mjs'), resolve(work, 'deny-network.mjs')),
    mkdir(output),
  ])
  const env = {
    PATH: process.env.PATH,
    HOME: resolve(work, 'home'),
    TMPDIR: resolve(work, 'tmp'),
    ARKIVE_RECOVERY_PASSPHRASE: metadata.testOnlyPassphrase,
    ARKIVE_ENDPOINT_LOG: endpointLog,
    NODE_OPTIONS: `--import=${pathToFileURL(resolve(work, 'deny-network.mjs')).href}`,
  }
  await Promise.all([mkdir(env.HOME), mkdir(env.TMPDIR)])
  const started = performance.now()
  const child = spawn(process.execPath, [resolve(tool, 'cli.mjs'), 'recover', fixture, '--output', output, '--json'], {
    cwd: work,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const exitCode = await new Promise((done) => child.on('close', done))
  let recoveredHash = null
  let exactByteMatch = false
  if (exitCode === 0) {
    const result = JSON.parse(stdout)
    recoveredHash = createHash('sha256').update(await readFile(result.outputPath)).digest('hex')
    exactByteMatch = recoveredHash === expected.plaintextSha256
  }
  const endpoints = await readFile(endpointLog, 'utf8').catch(() => '')
  const result = {
    experiment: 'CLEAN-ROOM',
    timestamp,
    environment: 'fresh temporary directory; only standalone tool, fixture, specification, runtime credential, expected hash, and network-denial preload supplied',
    runtime: process.version,
    networkState: 'blocked in process for fetch/http/https/net/tls',
    exactCommand: 'node arkive-recover/cli.mjs recover fixture.arkive --output output --json',
    expectedPlaintextSha256: expected.plaintextSha256,
    recoveredPlaintextSha256: recoveredHash,
    exactByteMatch,
    externalEndpointsContacted: endpoints.split('\n').filter(Boolean),
    durationMs: Math.round(performance.now() - started),
    result: exitCode === 0 && exactByteMatch ? 'PASS' : 'FAIL',
    errorClassification: exitCode === 0 ? null : stderr.match(/ARKIVE_RECOVERY_ERROR ([A-Z0-9_]+)/)?.[1] || 'implementation failure',
  }
  await mkdir(resolve(ROOT, 'research/results/latest'), { recursive: true })
  await writeFile(resolve(ROOT, 'research/results/latest/CLEAN-ROOM.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  if (result.result === 'FAIL') process.exitCode = 1
} finally {
  await rm(work, { recursive: true, force: true })
}
