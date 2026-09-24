import { spawnSync } from 'node:child_process'
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
  suite: 'ARKIVE Recovery Specification v1 public conformance',
  fixture: 'research/fixtures/archives/passphrase-v1.arkive',
  fixtureArchiveSha256: '1fe29c24402ff3e44b46882705bfceb86035295f3f81cb715823dc6878b705af',
  expectedPlaintextSha256: expected,
  recoveredPlaintextSha256: conformance ? expected : null,
  exactByteMatch: conformance,
  durationMs: Math.round(performance.now() - started),
  nodeConformance: node,
  pythonConformance: python,
  result: conformance ? 'PASS' : 'FAIL'
}
console.log(JSON.stringify(result, null, 2))
if (!conformance) process.exitCode = 1
