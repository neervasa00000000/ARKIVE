/**
 * RID custody after successful decentralized storage upload.
 *
 * Core invariant:
 * IF a valid storage RID has been returned,
 * THEN the user must be able to obtain a stamped recovery artifact
 * REGARDLESS of whether Base registration succeeds.
 *
 * Base registration is NOT a prerequisite for constructing the stamped artifact.
 */
import {
  RECOVERY_DISCOVERY_STATE,
  assertValidStorageRid,
  classifyRecoveryDiscoveryState,
  encodeOfflineRecoveryPackage,
  extractDiscoveryFromArtifact,
  suggestArkiveFileName,
} from './recoverySpec.js'

export { RECOVERY_DISCOVERY_STATE, assertValidStorageRid, extractDiscoveryFromArtifact }

/**
 * After a valid storage RID exists: stamp the recovery artifact first,
 * then optionally attempt registry registration.
 *
 * @param {object} args
 * @param {object} args.header - vault header (pre-stamp / unstamped RID fields OK)
 * @param {Uint8Array} args.encryptedFileBytes - ciphertext (unchanged)
 * @param {string} args.storageRid - upload-assigned RID
 * @param {string} [args.originalFileName]
 * @param {(rid: string) => Promise<unknown>} [args.registerOnChain] - injectable; omit or throw to simulate failure
 * @returns {Promise<object>} custody outcome — always includes stamped artifact when RID valid
 */
export async function finalizeAfterStorageRid({
  header,
  encryptedFileBytes,
  storageRid,
  originalFileName = 'archive',
  registerOnChain = null,
}) {
  const rid = assertValidStorageRid(storageRid)
  const offlinePackage = encodeOfflineRecoveryPackage(header, encryptedFileBytes, rid)
  const discovery = extractDiscoveryFromArtifact(offlinePackage)

  if (discovery.archiveId !== rid) {
    throw new Error('RID_STAMP_MISMATCH')
  }

  let registrationSucceeded = false
  let registrationError = null

  if (typeof registerOnChain === 'function') {
    try {
      await registerOnChain(rid)
      registrationSucceeded = true
    } catch (error) {
      registrationError = error
      registrationSucceeded = false
    }
  }

  const recoveryDiscoveryState = classifyRecoveryDiscoveryState({
    archiveId: rid,
    registryConfirmed: registrationSucceeded,
  })

  return {
    success: true,
    uploadSucceeded: true,
    registrationSucceeded,
    registrationError: registrationError
      ? String(registrationError?.message || registrationError)
      : null,
    arweaveId: rid,
    archiveId: rid,
    offlinePackage,
    offlineFileName: suggestArkiveFileName(originalFileName, rid),
    recoveryDiscoveryState,
    storageLocations: discovery.storageLocations,
    /** True when stamped bytes exist and must remain obtainable by the user. */
    recoveryArtifactAvailable: true,
  }
}

/**
 * UX-only protection: warn before exit when RID exists but the app has not
 * observed a user download/save of the stamped artifact.
 * Does not claim beforeunload guarantees preservation.
 */
export function shouldWarnBeforeDiscardingRecoveryCustody({
  ridPresent,
  recoveryArtifactSaved,
} = {}) {
  return Boolean(ridPresent) && !Boolean(recoveryArtifactSaved)
}

export function triggerRecoveryPackageDownload(offlinePackage, offlineFileName) {
  if (typeof document === 'undefined') {
    throw new Error('DOWNLOAD_REQUIRES_DOM')
  }
  if (!(offlinePackage instanceof Uint8Array) || !offlinePackage.length) {
    throw new Error('RECOVERY_PACKAGE_MISSING')
  }
  const name =
    typeof offlineFileName === 'string' && offlineFileName.endsWith('.arkive')
      ? offlineFileName
      : 'recovery.arkive'
  const blob = new Blob([offlinePackage], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
  return { downloaded: true, fileName: name }
}
