/**
 * ARKIVE Recovery Spec v1 helpers — stamp archives for offline / multi-network survival.
 * Spec: docs/RECOVERY-SPEC.md
 */
import { encodeVaultBundle, VAULT_SCHEMA_V3, parseVaultBytes } from './vaultBundle.js'
import { validateArweaveTxId } from './security.js'

export const RECOVERY_SPEC_VERSION = '1'

/** Internal recovery/discovery custody states — not equivalent. */
export const RECOVERY_DISCOVERY_STATE = Object.freeze({
  UNSTAMPED: 'UNSTAMPED',
  RID_STAMPED: 'RID_STAMPED',
  REGISTRY_CONFIRMED: 'REGISTRY_CONFIRMED',
})

/**
 * Validate a storage RID before stamping. Rejects empty / malformed / wrong-length IDs.
 * Uses the product Arweave/Turbo ID rules (`validateArweaveTxId`).
 */
export function assertValidStorageRid(rid) {
  return validateArweaveTxId(rid)
}

/**
 * Build storage location entries for known replicas.
 * Filecoin / other networks are reserved for future seals.
 */
export function buildStorageLocations({ arweaveId } = {}) {
  const locations = []
  if (arweaveId && typeof arweaveId === 'string') {
    const rid = assertValidStorageRid(arweaveId)
    locations.push({
      network: 'arweave',
      uri: `arweave://${rid}`,
      role: 'primary',
    })
  }
  return locations
}

/** Fields every new seal should include for long-term recoverability */
export function withRecoverySpecFields(header, { arweaveId = null } = {}) {
  let archiveId = null
  if (arweaveId != null && arweaveId !== '') {
    archiveId = assertValidStorageRid(arweaveId)
  } else if (header?.archiveId != null && header.archiveId !== '') {
    archiveId = assertValidStorageRid(header.archiveId)
  }
  return {
    ...header,
    recoverySpecVersion: RECOVERY_SPEC_VERSION,
    archiveId,
    storageLocations: buildStorageLocations({ arweaveId: archiveId }),
  }
}

/**
 * Offline recovery package (.arkive) — same bundle format, header stamped with archiveId
 * so a hard-drive copy remains recoverable without Base.
 *
 * INVARIANT: a valid storage RID is required. Malformed/empty RIDs are rejected.
 */
export function encodeOfflineRecoveryPackage(header, encryptedFileBytes, arweaveId) {
  const rid = assertValidStorageRid(arweaveId)
  const stamped = withRecoverySpecFields(header, { arweaveId: rid })
  if (!stamped.schema) stamped.schema = VAULT_SCHEMA_V3
  return encodeVaultBundle(stamped, encryptedFileBytes)
}

/**
 * Read RID / storageLocations from a stamped (or unstamped) artifact.
 * Does not consult Base or any network. Returns null RID when unstamped.
 */
export function extractDiscoveryFromArtifact(bundleBytes) {
  const payload = parseVaultBytes(bundleBytes)
  let archiveId = null
  if (typeof payload.archiveId === 'string' && payload.archiveId.length > 0) {
    try {
      archiveId = assertValidStorageRid(payload.archiveId)
    } catch {
      archiveId = null
    }
  }
  const storageLocations = Array.isArray(payload.storageLocations)
    ? payload.storageLocations
    : []
  const state = archiveId
    ? RECOVERY_DISCOVERY_STATE.RID_STAMPED
    : RECOVERY_DISCOVERY_STATE.UNSTAMPED
  return {
    archiveId,
    storageLocations,
    recoverySpecVersion: payload.recoverySpecVersion ?? null,
    recoveryDiscoveryState: state,
    payload,
  }
}

export function classifyRecoveryDiscoveryState({
  archiveId = null,
  registryConfirmed = false,
} = {}) {
  if (registryConfirmed && archiveId) {
    return RECOVERY_DISCOVERY_STATE.REGISTRY_CONFIRMED
  }
  if (archiveId) {
    return RECOVERY_DISCOVERY_STATE.RID_STAMPED
  }
  return RECOVERY_DISCOVERY_STATE.UNSTAMPED
}

export function suggestArkiveFileName(originalFileName, arweaveId) {
  const base = (originalFileName || 'archive')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 48)
  const short = typeof arweaveId === 'string' ? arweaveId.slice(0, 8) : 'local'
  return `${base || 'archive'}-${short}.arkive`
}

/** Human-facing labels — keep UX simple; do not expose internal enums. */
export function recoveryDiscoveryLabel(state) {
  switch (state) {
    case RECOVERY_DISCOVERY_STATE.REGISTRY_CONFIRMED:
      return 'Recovery copy ready · blockchain registration confirmed'
    case RECOVERY_DISCOVERY_STATE.RID_STAMPED:
      return 'Recovery copy ready · blockchain registration pending or failed'
    case RECOVERY_DISCOVERY_STATE.UNSTAMPED:
    default:
      return 'No storage identifier stamped yet'
  }
}
