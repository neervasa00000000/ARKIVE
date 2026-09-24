#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { inspectArchive, recoverWithPassphrase, RecoveryError } from './core.mjs'

function usage() {
  return [
    'Usage:',
    '  arkive-recover inspect <archive> [--json]',
    '  arkive-recover recover <archive> --output <directory> [--passphrase-file <file>] [--json]',
    '',
    'Passphrase input:',
    '  Prefer --passphrase-file. ARKIVE_RECOVERY_PASSPHRASE is supported for isolated tests.',
    '  Passphrases are never accepted as command-line values or printed.',
  ].join('\n')
}

function parseArgs(argv) {
  const [command, archive, ...rest] = argv
  const options = { json: false }
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg === '--json') options.json = true
    else if (arg === '--output') options.output = rest[++i]
    else if (arg === '--passphrase-file') options.passphraseFile = rest[++i]
    else throw new Error(`Unknown option: ${arg}`)
  }
  return { command, archive, options }
}

async function passphraseFrom(options) {
  if (options.passphraseFile) return (await readFile(resolve(options.passphraseFile), 'utf8')).replace(/\r?\n$/, '')
  if (process.env.ARKIVE_RECOVERY_PASSPHRASE) return process.env.ARKIVE_RECOVERY_PASSPHRASE
  throw new Error('Passphrase required via --passphrase-file or ARKIVE_RECOVERY_PASSPHRASE')
}

function printInspect(result, json) {
  if (json) return console.log(JSON.stringify(result, null, 2))
  console.log([
    'ARKIVE Recovery Inspection',
    '',
    `Bundle version: ${result.bundleVersion}`,
    `Recovery spec: ${result.recoverySpecVersion}`,
    `Archive integrity: ${result.archiveIntegrity}`,
    `Content hash: ${result.contentHashStatus}`,
    `Unlock methods: ${result.availableUnlockMethods.join(', ') || 'none'}`,
    `Encrypted metadata: ${result.encryptedMetadataPresent ? 'present' : 'absent'}`,
    `Archive SHA-256: ${result.archiveSha256}`,
  ].join('\n'))
}

async function main() {
  const { command, archive, options } = parseArgs(process.argv.slice(2))
  if (!archive || !['inspect', 'recover'].includes(command)) throw new Error(usage())
  const bytes = await readFile(resolve(archive))
  if (command === 'inspect') return printInspect(inspectArchive(bytes), options.json)
  if (!options.output) throw new Error('--output is required')

  const result = await recoverWithPassphrase(bytes, await passphraseFrom(options))
  const outputDirectory = resolve(options.output)
  await mkdir(outputDirectory, { recursive: true })
  const outputPath = join(outputDirectory, result.fileName)
  await writeFile(outputPath, result.plaintext, { flag: 'wx' })
  const printable = { ...result, plaintext: undefined, outputPath }
  if (options.json) console.log(JSON.stringify(printable, null, 2))
  else {
    console.log([
      'ARKIVE Recovery',
      '',
      `Bundle version: ${result.bundleVersion}`,
      `Recovery spec: ${result.recoverySpecVersion}`,
      `Unlock method: ${result.unlockMethod}`,
      `Recovered: ${outputPath}`,
      `Expected SHA-256: ${result.expectedSha256}`,
      `Recovered SHA-256: ${result.recoveredSha256}`,
      `Exact-byte recovery: ${result.exactByteMatch ? 'PASS' : 'FAIL'}`,
    ].join('\n'))
  }
}

main().catch((error) => {
  const code = error instanceof RecoveryError ? error.code : 'CLI_ERROR'
  console.error(`ARKIVE_RECOVERY_ERROR ${code}: ${error.message}`)
  process.exit(1)
})
