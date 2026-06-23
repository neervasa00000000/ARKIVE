// frontend/scripts/deploy-to-arweave.js
// Run: node scripts/deploy-to-arweave.js
// Requires: VITE_ARWEAVE_KEY set in .env
// Deploys the /dist folder to Arweave and prints the permanent app URL

import { TurboFactory } from '@ardrive/turbo-sdk'
import { ArweaveSigner } from '@dha-team/arbundles'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '../.env') })

const DIST_DIR = path.join(__dirname, '../dist')
const OUTPUT_FILE = path.join(__dirname, '../src/config/arweave-deployment.json')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function getAllFiles(dir, baseDir = dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      const relativePath = path.relative(baseDir, fullPath)
      files.push({ fullPath, relativePath })
    }
  }
  return files
}

async function deployFrontend() {
  console.log('=== ARKIVE Arweave Frontend Deployment ===\n')

  const jwkString = process.env.VITE_ARWEAVE_KEY
  if (!jwkString || jwkString === '{}') {
    console.error('ERROR: VITE_ARWEAVE_KEY not set in environment')
    console.error('Set it in arkive/frontend/.env as a JSON string of your Arweave JWK wallet')
    process.exit(1)
  }

  const jwk = JSON.parse(jwkString)
  const signer = new ArweaveSigner(jwk)
  const turbo = TurboFactory.authenticated({ signer })

  console.log('Checking Arweave balance...')
  try {
    const balance = await turbo.getBalance()
    console.log(`Balance: ${JSON.stringify(balance)}\n`)
  } catch {
    console.log('Balance check skipped\n')
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.error('ERROR: /dist directory not found. Run npm run build first.')
    process.exit(1)
  }

  const files = getAllFiles(DIST_DIR)
  console.log(`Found ${files.length} files to upload\n`)

  const uploadedFiles = []
  for (const file of files) {
    const fileData = fs.readFileSync(file.fullPath)
    const mimeType = getMimeType(file.fullPath)
    console.log(`Uploading: ${file.relativePath} (${mimeType})`)

    try {
      const result = await turbo.uploadFile({
        fileStreamFactory: () => fileData,
        fileSizeFactory: () => fileData.length,
        dataItemOpts: {
          tags: [
            { name: 'Content-Type', value: mimeType },
            { name: 'App-Name', value: 'ARKIVE' },
            { name: 'App-Version', value: '1.0.0' },
            { name: 'File-Path', value: file.relativePath },
          ],
        },
      })

      uploadedFiles.push({
        id: result.id,
        path: file.relativePath,
        mimeType,
      })

      console.log(`  ✓ ${result.id}`)
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`)
    }
  }

  console.log('\nCreating path manifest...')

  const manifestPaths = {}
  for (const file of uploadedFiles) {
    const arweavePath = file.path.replace(/\\/g, '/')
    manifestPaths[arweavePath] = { id: file.id }
  }

  const indexFile = uploadedFiles.find((f) => f.path === 'index.html')

  const manifest = {
    manifest: 'arweave/paths',
    version: '0.2.0',
    index: { path: 'index.html' },
    fallback: { id: indexFile?.id },
    paths: manifestPaths,
  }

  const manifestData = new TextEncoder().encode(JSON.stringify(manifest))

  const manifestResult = await turbo.uploadFile({
    fileStreamFactory: () => manifestData,
    fileSizeFactory: () => manifestData.length,
    dataItemOpts: {
      tags: [
        { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
        { name: 'App-Name', value: 'ARKIVE' },
        { name: 'Type', value: 'app-manifest' },
      ],
    },
  })

  const manifestId = manifestResult.id
  console.log(`\nPath manifest deployed: ${manifestId}`)

  console.log('\nPublishing recovery guide to Arweave...')

  const recoveryGuide = {
    title: 'ARKIVE Recovery Guide',
    version: '1.0.0',
    publishedAt: new Date().toISOString(),
    description: 'How to access your ARKIVE data if the platform disappears.',
    permanentAppUrl: `https://arweave.net/${manifestId}`,
    arnsUrl: 'https://arkive.ar.io',
    contractAddresses: {
      network: 'Base Sepolia',
      chainId: 84532,
      PostRegistry: process.env.VITE_POST_REGISTRY || 'See contracts.js',
      VaultRegistry: process.env.VITE_VAULT_REGISTRY || 'See contracts.js',
      UserRegistry: process.env.VITE_USER_REGISTRY || 'See contracts.js',
      PointsSystem: process.env.VITE_POINTS_SYSTEM || 'See contracts.js',
    },
    recoverySteps: {
      feed: [
        `1. Go to https://arweave.net/${manifestId}`,
        '2. Connect your wallet on Base network',
        '3. Your posts load automatically from the blockchain',
        '4. Manual: visit basescan.org → PostRegistry → getUserPostIds([your-wallet])',
      ],
      vault: [
        `1. Go to https://arweave.net/${manifestId}`,
        '2. Connect the wallet that encrypted your files',
        '3. Go to Vault page — file list loads from the blockchain',
        '4. Click any file and sign with MetaMask to decrypt',
        '5. If Lit Protocol is unavailable: click "Use Wallet Fallback Instead"',
        '6. Emergency manual recovery: see /recover page in the app',
      ],
    },
    dualEncryptionExplainer: {
      description: 'Every vault file is protected by two independent encryption paths',
      primaryPath: 'Lit Protocol — convenient, requires Lit network to be online',
      fallbackPath: 'Wallet signature derivation — works forever with MetaMask and seed phrase',
      derivationMessage: 'ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT',
      derivationProcess: 'Sign derivation message → keccak256 hash → AES-256-GCM key → decrypt walletEncryptedAesKey → decrypt encryptedFile',
    },
    seedPhraseWarning: 'Your 12-word seed phrase is your master key. No seed phrase = no recovery.',
  }

  const recoveryData = new TextEncoder().encode(JSON.stringify(recoveryGuide, null, 2))
  const recoveryResult = await turbo.uploadFile({
    fileStreamFactory: () => recoveryData,
    fileSizeFactory: () => recoveryData.length,
    dataItemOpts: {
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'ARKIVE' },
        { name: 'Type', value: 'recovery-guide' },
      ],
    },
  })

  const recoveryGuideId = recoveryResult.id
  console.log(`Recovery guide deployed: ${recoveryGuideId}`)

  const deployment = {
    deployedAt: new Date().toISOString(),
    appManifestTxId: manifestId,
    recoveryGuideTxId: recoveryGuideId,
    permanentAppUrl: `https://arweave.net/${manifestId}`,
    permanentRecoveryUrl: `https://arweave.net/${recoveryGuideId}`,
    alternativeGateways: [
      `https://g8way.io/${manifestId}`,
      `https://gateway.irys.xyz/${manifestId}`,
    ],
    filesUploaded: uploadedFiles.length,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deployment, null, 2))
  console.log('\nDeployment record saved to src/config/arweave-deployment.json')

  console.log('\n=== DEPLOYMENT COMPLETE ===\n')
  console.log('Permanent app URL:')
  console.log(`  https://arweave.net/${manifestId}\n`)
  console.log('Recovery guide URL:')
  console.log(`  https://arweave.net/${recoveryGuideId}\n`)
  console.log('NEXT STEPS:')
  console.log('1. Add to arkive/frontend/.env:')
  console.log(`   VITE_ARWEAVE_APP_TX=${manifestId}`)
  console.log(`   VITE_ARWEAVE_RECOVERY_TX=${recoveryGuideId}`)
  console.log('2. Rebuild: npm run build')
  console.log('3. Redeploy preview: npm run build:arkive-preview (from repo root)')

  return deployment
}

deployFrontend().catch((err) => {
  console.error(err)
  process.exit(1)
})
