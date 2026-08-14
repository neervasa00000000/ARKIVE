import { DEMO_ADDRESS } from '../config/demo'

const SEAL_STEPS = [
  { label: 'Encrypting on your device', duration: 1400 },
  { label: 'Sealing to Arweave', duration: 1800 },
  { label: 'Writing to blockchain', duration: 1200 },
  { label: 'Done. Permanent.', duration: 600 },
]

const UNLOCK_STEPS = [
  { label: 'Requesting signature', duration: 1000 },
  { label: 'Verifying ownership', duration: 800 },
  { label: 'Decrypting record', duration: 1200 },
]

export function createInitialRecords() {
  return [
    {
      id: 'demo-1',
      fileName: 'family-will-draft.pdf',
      sealedAt: new Date('2026-03-12').getTime(),
      lastOpenedAt: null,
      arweaveTxId: 'xK9mP2vL8nQ4rT6wY1zA3bC5dE7fG9hJ0kM2nP4qR6sT8uV0wX2yZ4',
      walletAddress: DEMO_ADDRESS,
      fileType: 'document',
    },
    {
      id: 'demo-2',
      fileName: 'medical-records-2025.pdf',
      sealedAt: new Date('2026-01-08').getTime(),
      lastOpenedAt: new Date('2026-02-02').getTime(),
      arweaveTxId: 'aB3cD5eF7gH9iJ1kL3mN5oP7qR9sT1uV3wX5yZ7aB9cD1eF3gH5iJ7',
      walletAddress: DEMO_ADDRESS,
      fileType: 'document',
    },
    {
      id: 'demo-3',
      fileName: 'wedding-photos-archive.zip',
      sealedAt: new Date('2025-06-01').getTime(),
      lastOpenedAt: null,
      arweaveTxId: 'mN7oP9qR1sT3uV5wX7yZ9aB1cD3eF5gH7iJ9kL1mN3oP5qR7sT9uV1wX3',
      walletAddress: DEMO_ADDRESS,
      fileType: 'other',
    },
  ]
}

export function generateArweaveTxId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  return Array.from({ length: 43 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function generateRecordId() {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function simulateSealProgress(onStep) {
  for (let i = 0; i < SEAL_STEPS.length; i++) {
    onStep(i, SEAL_STEPS[i].label)
    await delay(SEAL_STEPS[i].duration)
  }
  return SEAL_STEPS.length - 1
}

export async function simulateUnlockProgress(onStep) {
  for (let i = 0; i < UNLOCK_STEPS.length; i++) {
    onStep(i, UNLOCK_STEPS[i].label)
    await delay(UNLOCK_STEPS[i].duration)
  }
}

export const SEAL_STEP_LABELS = SEAL_STEPS.map((s) => s.label)

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function formatSealedDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatLastOpened(timestamp) {
  if (!timestamp) return 'never'
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
