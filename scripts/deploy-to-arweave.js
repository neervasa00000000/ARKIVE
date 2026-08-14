#!/usr/bin/env node
/** Run from repo root after frontend build: node scripts/deploy-to-arweave.js */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const frontendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend')
execSync('node scripts/deploy-to-arweave.js', { cwd: frontendDir, stdio: 'inherit' })
