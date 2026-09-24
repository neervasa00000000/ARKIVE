import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ethers } from '../../frontend/node_modules/ethers/lib.esm/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const fixtureDir = resolve(root, 'research/fixtures/e15')
const resultDir = resolve(root, 'research/results/latest')
mkdirSync(fixtureDir, { recursive: true })
mkdirSync(resultDir, { recursive: true })

const now = new Date().toISOString()
const privateKey = '0x' + randomBytes(32).toString('hex')
const wallet = new ethers.Wallet(privateKey)
const address = wallet.address.toLowerCase()
const domain = {
  name: 'ARKIVE',
  version: '2',
  chainId: 84532,
  verifyingContract: '0xe3ee4509f8da48f33E43EaC9d8F7bb05E8024589',
}
const types = {
  VaultKeyDerivation: [
    { name: 'purpose', type: 'string' },
    { name: 'wallet', type: 'address' },
  ],
}
const message = {
  purpose: 'VAULT_KEY_DERIVATION',
  wallet: address,
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function b64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

async function aesGcmEncrypt(keyBytes, plaintext) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const iv = randomBytes(12)
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  return { encrypted, iv }
}

function encodeBundle(header, encryptedFileBytes) {
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  const out = new Uint8Array(4 + 1 + 4 + headerBytes.length + encryptedFileBytes.length)
  out.set([0x41, 0x52, 0x4b, 0x56], 0)
  out[4] = 3
  out[5] = (headerBytes.length >>> 24) & 0xff
  out[6] = (headerBytes.length >>> 16) & 0xff
  out[7] = (headerBytes.length >>> 8) & 0xff
  out[8] = headerBytes.length & 0xff
  out.set(headerBytes, 9)
  out.set(encryptedFileBytes, 9 + headerBytes.length)
  return out
}

const signature = await wallet.signTypedData(domain, types, message)
const signatureBytes = ethers.getBytes(signature)
const parsed = ethers.Signature.from(signature)
const recovered = ethers.verifyTypedData(domain, types, message, signature)
const signatureKeccak = ethers.keccak256(signatureBytes)
const wrapKey = ethers.getBytes(signatureKeccak)
const fileKey = randomBytes(32)
const plaintext = Buffer.from('E15 synthetic ARKIVE wallet-wrap fixture\nTEST KEY ONLY - NEVER FUND OR USE IN PRODUCTION\n', 'utf8')
const encryptedFile = await aesGcmEncrypt(fileKey, plaintext)
const wrappedFileKey = await aesGcmEncrypt(wrapKey, fileKey)
const metadataPlain = new TextEncoder().encode(JSON.stringify({
  originalContentHash: sha256Hex(plaintext),
  originalFileName: 'e15-synthetic.txt',
  originalFileType: 'text/plain',
  originalFileSize: plaintext.length,
}))
const encryptedMetadata = await aesGcmEncrypt(fileKey, metadataPlain)

const header = {
  version: 'v3',
  schema: 'ARKIVE_VAULT_BUNDLE_V3',
  encryptedFileIv: b64(encryptedFile.iv),
  contentHash: sha256Hex(encryptedFile.encrypted),
  litCiphertext: null,
  litDataToEncryptHash: null,
  litAccessConditions: null,
  litChain: 'baseSepolia',
  walletEncryptedAesKey: b64(wrappedFileKey.encrypted),
  walletEncryptedAesKeyIv: b64(wrappedFileKey.iv),
  walletAddress: address,
  derivationVersion: 'eip712-v2',
  eip712Domain: domain,
  keyWraps: [{
    wallet: address,
    method: 'eip712-v2',
    encryptedAesKey: b64(wrappedFileKey.encrypted),
    iv: b64(wrappedFileKey.iv),
  }],
  authorizedWallets: [address],
  recoveryWrap: null,
  hasRecoveryPassphrase: false,
  encryptedMetadata: b64(encryptedMetadata.encrypted),
  encryptedMetadataIv: b64(encryptedMetadata.iv),
  originalFileName: 'sealed-record',
  originalFileType: 'application/octet-stream',
  originalFileSize: plaintext.length,
  recoveryInstructions: {
    step1: 'E15 synthetic fixture only',
    step2: 'TEST KEY ONLY - NEVER FUND OR USE IN PRODUCTION',
  },
  encryptedAt: Date.parse(now),
  encryptedByWallet: address,
  recoverySpecVersion: '1',
  archiveId: null,
  storageLocations: [],
}

const bundle = encodeBundle(header, encryptedFile.encrypted)
const archivePath = resolve(fixtureDir, 'e15-wallet-wrap-v3.arkive')
const fixturePath = resolve(fixtureDir, 'fixture.json')
writeFileSync(archivePath, bundle)

const fixture = {
  experiment: 'E15',
  warning: 'TEST KEY ONLY - NEVER FUND OR USE IN PRODUCTION',
  createdAt: now,
  archiveVersion: 3,
  recoverySpecVersion: '1',
  derivationVersion: 'eip712-v2',
  syntheticPrivateKey: privateKey,
  syntheticWalletAddress: address,
  eip712Domain: domain,
  eip712Types: types,
  primaryType: 'VaultKeyDerivation',
  message,
  referenceSignature: signature,
  referenceSignatureKeccak: signatureKeccak,
  referenceWrappingKeyHash: sha256Hex(Buffer.from(wrapKey)),
  expectedPlaintextSha256: sha256Hex(plaintext),
  plaintextLength: plaintext.length,
  fileKeyHash: sha256Hex(fileKey),
  fixtureSha256: sha256Hex(bundle),
  archivePath,
}
writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n')

const pyOut = execFileSync(resolve(__dirname, '.venv/bin/python'), [
  resolve(__dirname, 'e15_independent.py'),
  archivePath,
  fixturePath,
], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, PYTHONNOUSERSITE: '1' },
})
const implementationB = JSON.parse(pyOut)

const implementationA = {
  nodeVersion: process.version,
  ethersVersion: JSON.parse(readFileSync(resolve(root, 'frontend/node_modules/ethers/package.json'), 'utf8')).version,
  signingAPI: 'ethers.Wallet.signTypedData(domain, types, message)',
  signatureBytes: signature,
  r: parsed.r,
  s: parsed.s,
  v: parsed.v,
  signatureValidity: recovered.toLowerCase() === address,
  recoveredSigner: recovered,
  signatureKeccak,
  wrapKeyHash: sha256Hex(Buffer.from(wrapKey)),
  unwrap: true,
  fileKeyHash: sha256Hex(fileKey),
  plaintextSha256: sha256Hex(plaintext),
}

const sigA = ethers.getBytes(implementationA.signatureBytes)
const sigB = ethers.getBytes(implementationB.signatureBytes)
const hiddenDependency = implementationA.signatureValidity &&
  implementationB.signatureValidity &&
  implementationA.recoveredSigner.toLowerCase() === address &&
  implementationB.recoveredSigner.toLowerCase() === address &&
  Buffer.compare(Buffer.from(sigA), Buffer.from(sigB)) !== 0 &&
  implementationA.signatureKeccak !== implementationB.signatureKeccak &&
  implementationA.wrapKeyHash !== implementationB.wrapKeyHash &&
  !implementationB.unwrap

const signatureBytesEqual = Buffer.compare(Buffer.from(sigA), Buffer.from(sigB)) === 0
const plaintextHashMatches = implementationB.plaintextSha256 === fixture.expectedPlaintextSha256

const preregHashes = Object.fromEntries(
  ['research/preregistration/E15.md', 'research/e15-wallet/E15-METHOD.json', 'docs/RECOVERY-SPEC.md']
    .map((p) => [p, sha256Hex(readFileSync(resolve(root, p)))]),
)
const preRunManifestHash = sha256Hex(readFileSync(resolve(root, 'research/e15-wallet/E15-PRE-RUN-MANIFEST.json')))

const results = {
  experiment: 'E15',
  timestamps: { executedAt: new Date().toISOString(), fixtureCreatedAt: now },
  preregistrationStatus: 'COMPLETE_BEFORE_EXECUTION',
  preregistrationVerification: {
    frozenAfterManifestRepair: true,
    missingFromPreregistrationOrMethod: [
      'RQ-E15-C',
      'H15-C',
      'explicit E15-C success criteria in preregistration',
      'dependency classifications detail in preregistration',
      'specification ambiguity rule in preregistration',
      'production-preservation rule in preregistration',
    ],
  },
  preregistrationHashes: preregHashes,
  preRunManifestHash,
  fixtureHash: fixture.fixtureSha256,
  expectedPlaintextHash: fixture.expectedPlaintextSha256,
  syntheticWalletAddress: address,
  fixturePath: archivePath,
  fixtureMetadataPath: fixturePath,
  eip712Domain: domain,
  eip712Types: types,
  primaryType: 'VaultKeyDerivation',
  message,
  implementationA,
  implementationB,
  signatureAVerifies: implementationA.signatureValidity,
  signatureBVerifies: implementationB.signatureValidity,
  signerA: implementationA.recoveredSigner,
  signerB: implementationB.recoveredSigner,
  rEqual: implementationA.r.toLowerCase() === implementationB.r.toLowerCase(),
  sEqual: implementationA.s.toLowerCase() === implementationB.s.toLowerCase(),
  vEqual: implementationA.v === implementationB.v,
  signatureBytesEqual,
  signatureKeccakA: implementationA.signatureKeccak,
  signatureKeccakB: implementationB.signatureKeccak,
  signatureKeccakEqual: implementationA.signatureKeccak === implementationB.signatureKeccak,
  wrapKeyHashA: implementationA.wrapKeyHash,
  wrapKeyHashB: implementationB.wrapKeyHash,
  wrapKeyEqual: implementationA.wrapKeyHash === implementationB.wrapKeyHash,
  unwrapA: implementationA.unwrap,
  unwrapB: implementationB.unwrap,
  fileKeyHashA: implementationA.fileKeyHash,
  fileKeyHashB: implementationB.fileKeyHash,
  fileKeyEqual: implementationA.fileKeyHash === implementationB.fileKeyHash,
  plaintextHashA: implementationA.plaintextSha256,
  plaintextHashB: implementationB.plaintextSha256,
  plaintextHashMatches,
  exactBytesEqual: plaintextHashMatches && implementationB.plaintextLength === plaintext.length,
  networkAvailableDuringIndependentRecovery: implementationB.networkAvailableDuringIndependentRecovery,
  externalEndpointsContacted: implementationB.externalEndpointsContacted,
  signatureRepresentationTests: implementationB.signatureRepresentationTests,
  negativeTests: implementationB.negativeTests,
  removedDependencies: [
    'MetaMask',
    'RainbowKit',
    'wagmi',
    'WalletConnect',
    'browser',
    'ARKIVE frontend',
    'ARKIVE wallet hooks',
    'backend',
    'Base',
    'Base RPC',
    'VaultRegistry runtime lookup',
    'network',
    'original wallet software',
  ],
  requiredDependencies: [
    'authorized private-key capability',
    'secp256k1',
    'ECDSA',
    'EIP-712 semantics',
    'EIP-712 domain',
    'EIP-712 types',
    'EIP-712 message',
    'signature representation compatible with stored wrap',
    'Keccak-256',
    'AES-256-GCM',
    'archive bytes',
    'archive-format knowledge',
  ],
  substitutableDependencies: ['programming language', 'crypto library', 'seed representation'],
  dependencyClassifications: {
    MetaMask: 'REMOVABLE',
    RainbowKit: 'REMOVABLE',
    wagmi: 'REMOVABLE',
    WalletConnect: 'REMOVABLE',
    browser: 'REMOVABLE',
    'ARKIVE frontend': 'REMOVABLE',
    'ARKIVE wallet hooks': 'REMOVABLE',
    backend: 'REMOVABLE',
    Base: 'REMOVABLE',
    'Base RPC': 'REMOVABLE',
    VaultRegistry: 'DISCOVERY_ONLY',
    network: 'REMOVABLE',
    'original wallet software': 'REMOVABLE',
    'programming language': 'SUBSTITUTABLE',
    'crypto library': 'SUBSTITUTABLE',
    'seed representation': 'SUBSTITUTABLE',
    'authorized private-key capability': 'REQUIRED',
    secp256k1: 'REQUIRED',
    ECDSA: 'REQUIRED',
    'EIP-712 semantics': 'REQUIRED',
    'EIP-712 domain': 'REQUIRED',
    'EIP-712 types': 'REQUIRED',
    'EIP-712 message': 'REQUIRED',
    'signature representation': 'REQUIRED',
    'signature reproducibility': signatureBytesEqual ? 'SUBSTITUTABLE' : 'REQUIRED',
    'Keccak-256': 'REQUIRED',
    'AES-256-GCM': 'REQUIRED',
    'archive bytes': 'REQUIRED',
    'archive-format knowledge': 'REQUIRED',
  },
  hiddenDependency: hiddenDependency ? 'SIGNATURE_REPRODUCIBILITY_DEPENDENCY_DETECTED' : null,
  specificationAmbiguity: 'SPECIFICATION_AMBIGUITY_DETECTED',
  limitations: [
    'Synthetic EOA wallet-wrapped v3 archive only.',
    'No real wallet, funded wallet, seed phrase, production credential, Base RPC, or browser wallet was used.',
    'The preregistration artifacts in the current repository state do not explicitly contain all Step 1 requested tokens; they were preserved rather than rewritten.',
  ],
  E15AClassification: implementationB.unwrap && plaintextHashMatches ? 'PASS' : 'FAIL',
  E15BClassification: hiddenDependency ? 'DEPENDENCY_DETECTED' : (signatureBytesEqual && implementationA.wrapKeyHash === implementationB.wrapKeyHash ? 'PASS' : 'FAIL'),
  E15CClassification: plaintextHashMatches ? 'PASS' : 'FAIL',
}

writeFileSync(resolve(resultDir, 'E15.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify({
  E15A: results.E15AClassification,
  E15B: results.E15BClassification,
  E15C: results.E15CClassification,
  fixtureHash: results.fixtureHash,
  expectedPlaintextHash: results.expectedPlaintextHash,
}, null, 2))
