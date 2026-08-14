#!/usr/bin/env node
/** Run from repo root: node scripts/deploy.js [--network baseSepolia] */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const contractsDir = path.join(root, 'contracts')

const networkFlag = process.argv.indexOf('--network')
const network =
  networkFlag >= 0 ? process.argv[networkFlag + 1] || 'baseSepolia' : 'baseSepolia'

console.log(`Deploying ARKIVE contracts (${network})...\n`)
execSync(`npx hardhat run scripts/deploy.js --network ${network}`, {
  cwd: contractsDir,
  stdio: 'inherit',
})
