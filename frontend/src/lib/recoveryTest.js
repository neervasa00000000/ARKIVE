import { VAULT_BUNDLE_VERSION, VAULT_SCHEMA_V3 } from './vaultBundle.js'
import { decryptVaultWithPassphrase } from './vaultCrypto.js'
import { sha256Hex } from './vaultKeyWrap.js'

export const RECOVERY_TEST_STORAGE_KEY = 'arkive_recovery_test_records_v1'
export const RECOVERY_TEST_EVENT = 'arkive:recovery-test-updated'

export function assertRecoveryTestCompatible(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('RECOVERY_UNAVAILABLE')
  if (payload.bundleVersion !== VAULT_BUNDLE_VERSION || payload.schema !== VAULT_SCHEMA_V3) {
    throw new Error('UNSUPPORTED_BUNDLE_VERSION')
  }
  if (payload.recoverySpecVersion !== '1') throw new Error('UNSUPPORTED_RECOVERY_SPEC')
  return payload
}

export function availableRecoveryMethods(payload, connectedAddress = null) {
  assertRecoveryTestCompatible(payload)
  const methods = []
  if (payload.recoveryWrap?.method === 'passphrase-v1') methods.push('passphrase')
  if (connectedAddress && Array.isArray(payload.keyWraps)) {
    const connected = connectedAddress.toLowerCase()
    const wrap = payload.keyWraps.find((item) => item?.wallet?.toLowerCase() === connected)
    if (wrap) {
      const owner = (payload.encryptedByWallet || payload.walletAddress || '').toLowerCase()
      methods.push(owner === connected ? 'owner-wallet' : 'backup-wallet')
    }
  }
  return methods
}

export async function verifyExactRecovery(payload, decrypted) {
  assertRecoveryTestCompatible(payload)
  const expected = decrypted?.meta?.originalContentHash
  if (!/^[a-f0-9]{64}$/i.test(expected || '')) throw new Error('ORIGINAL_HASH_UNAVAILABLE')
  const actual = await sha256Hex(decrypted.decryptedBytes)
  if (actual !== expected) throw new Error('ORIGINAL_HASH_MISMATCH')
  return true
}

export function createRecoveryTestRecord(payload, { archiveId, method, testedAt = new Date().toISOString() }) {
  if (!['passphrase', 'owner-wallet', 'backup-wallet'].includes(method)) throw new Error('INVALID_RECOVERY_METHOD')
  return Object.freeze({
    archiveId: String(archiveId || payload.archiveId || ''),
    bundleVersion: payload.bundleVersion,
    recoverySpecVersion: payload.recoverySpecVersion,
    method,
    testedAt,
    integrityVerified: true,
    plaintextHashMatched: true,
    appVersion: '0.1.0',
  })
}

export async function testPassphraseRecovery(payload, passphrase, options = {}) {
  assertRecoveryTestCompatible(payload)
  if (!payload.recoveryWrap) throw new Error('RECOVERY_UNAVAILABLE')
  let decrypted
  try {
    decrypted = await decryptVaultWithPassphrase(payload, passphrase)
    await verifyExactRecovery(payload, decrypted)
    return createRecoveryTestRecord(payload, {
      archiveId: options.archiveId,
      method: 'passphrase',
      testedAt: options.testedAt,
    })
  } finally {
    decrypted?.decryptedBytes?.fill(0)
  }
}

export function readRecoveryTestRecords(storage = globalThis.localStorage) {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(RECOVERY_TEST_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isSafeRecord) : []
  } catch {
    return []
  }
}

export function saveRecoveryTestRecord(record, storage = globalThis.localStorage) {
  if (!storage || !isSafeRecord(record)) throw new Error('INVALID_RECOVERY_TEST_RECORD')
  const safeRecord = {
    archiveId: record.archiveId,
    bundleVersion: record.bundleVersion,
    recoverySpecVersion: record.recoverySpecVersion,
    method: record.method,
    testedAt: record.testedAt,
    integrityVerified: record.integrityVerified,
    plaintextHashMatched: record.plaintextHashMatched,
    ...(record.appVersion ? { appVersion: record.appVersion } : {}),
  }
  const records = readRecoveryTestRecords(storage).filter((item) => item.archiveId !== safeRecord.archiveId)
  storage.setItem(RECOVERY_TEST_STORAGE_KEY, JSON.stringify([safeRecord, ...records].slice(0, 100)))
  globalThis.dispatchEvent?.(new Event(RECOVERY_TEST_EVENT))
  return safeRecord
}

export function clearRecoveryTestRecords(storage = globalThis.localStorage) {
  storage?.removeItem(RECOVERY_TEST_STORAGE_KEY)
  globalThis.dispatchEvent?.(new Event(RECOVERY_TEST_EVENT))
}

export function recoveryFailureCategory(error) {
  const message = error?.message || ''
  if (message.includes('UNSUPPORTED_BUNDLE')) return 'unsupported bundle version'
  if (message.includes('UNSUPPORTED_RECOVERY_SPEC')) return 'unsupported recovery specification'
  if (message.includes('NO_RECOVERY') || message.includes('RECOVERY_UNAVAILABLE')) return 'recovery unavailable'
  if (message.includes('CONTENT_HASH') || message.includes('ORIGINAL_HASH') || message.includes('INVALID_ENCRYPTED_DATA')) return 'archive integrity failure'
  if (message.includes('OperationError') || error?.name === 'OperationError') return 'wrong credential or archive integrity failure'
  return 'recovery could not be verified'
}

function isSafeRecord(record) {
  return Boolean(
    record &&
    typeof record.archiveId === 'string' &&
    Number.isInteger(record.bundleVersion) &&
    typeof record.recoverySpecVersion === 'string' &&
    ['passphrase', 'owner-wallet', 'backup-wallet'].includes(record.method) &&
    typeof record.testedAt === 'string' &&
    record.integrityVerified === true &&
    record.plaintextHashMatched === true
  )
}
