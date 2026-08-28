/**
 * ARKIVE Recovery Spec v1 helpers — stamp archives for offline / multi-network survival.
 * Spec: docs/RECOVERY-SPEC.md
 */
import { encodeVaultBundle, VAULT_SCHEMA_V3 } from './vaultBundle.js'

export const RECOVERY_SPEC_VERSION = '1'

/**
 * Build storage location entries for known replicas.
 * Filecoin / other networks are reserved for future seals.
 */
export function buildStorageLocations({ arweaveId } = {}) {
  const locations = []
  if (arweaveId && typeof arweaveId === 'string') {
    locations.push({
      network: 'arweave',
      uri: `arweave://${arweaveId}`,
      role: 'primary',
    })
  }
  return locations
}

/** Fields every new seal should include for long-term recoverability */
export function withRecoverySpecFields(header, { arweaveId = null } = {}) {
  return {
    ...header,
    recoverySpecVersion: RECOVERY_SPEC_VERSION,
    archiveId: arweaveId || header.archiveId || null,
    storageLocations: buildStorageLocations({
      arweaveId: arweaveId || header.archiveId || null,
    }),
  }
}

/**
 * Offline recovery package (.arkive) — same bundle format, header stamped with archiveId
 * so a hard-drive copy remains recoverable without Base.
 */
export function encodeOfflineRecoveryPackage(header, encryptedFileBytes, arweaveId) {
  const stamped = withRecoverySpecFields(header, { arweaveId })
  if (!stamped.schema) stamped.schema = VAULT_SCHEMA_V3
  return encodeVaultBundle(stamped, encryptedFileBytes)
}

export function suggestArkiveFileName(originalFileName, arweaveId) {
  const base = (originalFileName || 'archive')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 48)
  const short = typeof arweaveId === 'string' ? arweaveId.slice(0, 8) : 'local'
  return `${base || 'archive'}-${short}.arkive`
}
