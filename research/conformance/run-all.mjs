import { spawnSync, execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const run = (command, args) => {
  const child = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' })
  if (child.status !== 0) throw new Error(child.stderr || child.stdout || `${command} failed`)
  return JSON.parse(child.stdout)
}
const started = performance.now()
const node = run(process.execPath, [resolve(ROOT, 'research/conformance/run-node.mjs')])
const python = run('python3', [resolve(ROOT, 'research/conformance/run-python.py')])
const expected = '8e5ed1e6474d39bf1594411085e7a50c15aabaa768e633ebf0960ce20e84e336'
const conformance = node.result === 'PASS' && python.result === 'PASS' && node.plaintextSha256 === python.plaintextSha256 && node.plaintextSha256 === expected
const result = {
  experiment: 'E13',
  description: 'Recovery Specification v1 sufficiency and cross-implementation conformance',
  timestamp: new Date().toISOString(),
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  gitDirty: true,
  fixture: 'research/fixtures/archives/passphrase-v1.arkive',
  fixtureArchiveSha256: '1fe29c24402ff3e44b46882705bfceb86035295f3f81cb715823dc6878b705af',
  removedDependencies: ['undocumented_wire_format_assumptions'],
  availableDependencies: ['clarified_recovery_spec_v1', 'published_conformance_vectors', 'node_implementation', 'python_implementation'],
  expectedOutcome: 'SPECIFICATION_CONFORMANCE',
  actualOutcome: conformance ? 'RECOVERY_SUCCESS' : 'RECOVERY_REJECTED',
  errorClassification: conformance ? null : 'CONFORMANCE_MISMATCH',
  expectedPlaintextSha256: expected,
  recoveredPlaintextSha256: conformance ? expected : null,
  exactByteMatch: conformance,
  externalEndpointsContacted: [],
  durationMs: Math.round(performance.now() - started),
  specificationConformance: conformance ? 'PASS' : 'FAIL',
  nodeConformance: node,
  pythonConformance: python,
  independentSpecificationOnlyReimplementation: 'NOT VALIDATED',
  limitation: 'The Python implementation predates the clarified specification, so this run cannot establish that a fresh implementer could derive compatibility from the document alone.',
  result: conformance ? 'NOT VALIDATED' : 'FAIL'
}
await mkdir(resolve(ROOT, 'research/results/latest'), { recursive: true })
await writeFile(resolve(ROOT, 'research/results/latest/E13.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
if (!conformance) process.exitCode = 1
