/**
 * Zero-loss image optimization — never touches pixel/scan data.
 *
 * JPEG: strips the EXIF (APP1) segment when it's provably safe to do so (no
 * orientation tag, or orientation === 1/normal). This is a pure byte-level
 * removal of metadata that sits *before* the compressed scan data (SOS) —
 * the actual image bytes are never parsed, decoded, or re-encoded, so the
 * result decodes to pixel-for-pixel identical output. Any parsing
 * uncertainty (unrecognised structure, non-default orientation, truncated
 * data) bails out and returns the original bytes untouched — this never
 * risks correctness for byte savings.
 */

const SOI = 0xd8
const SOS = 0xda
const APP1 = 0xe1
// Markers with no length field, or that should never appear before SOS in a
// well-formed header — seeing one here means the parse assumption broke.
const UNEXPECTED_BEFORE_SOS = new Set([0x01, 0xd8, 0xd9])

function isRestartMarker(marker) {
  return marker >= 0xd0 && marker <= 0xd7
}

function readUint16(bytes, offset, littleEndian) {
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1]
}

function readUint32(bytes, offset, littleEndian) {
  return littleEndian
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

/**
 * Parses an APP1 payload as EXIF/TIFF and returns the Orientation tag value.
 * `recognized: false` means "this isn't a structure we can confidently
 * parse" (e.g. XMP metadata using the same APP1 marker, or malformed data) —
 * callers must treat unrecognised payloads as unsafe to strip.
 */
function parseExifOrientation(payload) {
  if (payload.length < 14) return { recognized: false, orientation: null }

  const isExifSignature =
    payload[0] === 0x45 && payload[1] === 0x78 && payload[2] === 0x69 &&
    payload[3] === 0x66 && payload[4] === 0x00 && payload[5] === 0x00
  if (!isExifSignature) return { recognized: false, orientation: null }

  const tiffStart = 6
  const b0 = payload[tiffStart]
  const b1 = payload[tiffStart + 1]
  let littleEndian
  if (b0 === 0x49 && b1 === 0x49) littleEndian = true
  else if (b0 === 0x4d && b1 === 0x4d) littleEndian = false
  else return { recognized: false, orientation: null }

  if (readUint16(payload, tiffStart + 2, littleEndian) !== 0x002a) {
    return { recognized: false, orientation: null }
  }

  const ifd0OffsetRel = readUint32(payload, tiffStart + 4, littleEndian)
  const ifd0Start = tiffStart + ifd0OffsetRel
  if (ifd0OffsetRel < 8 || ifd0Start + 2 > payload.length) {
    return { recognized: false, orientation: null }
  }

  const entryCount = readUint16(payload, ifd0Start, littleEndian)
  const entriesStart = ifd0Start + 2
  if (entryCount < 0 || entriesStart + entryCount * 12 > payload.length) {
    return { recognized: false, orientation: null }
  }

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = entriesStart + i * 12
    const tag = readUint16(payload, entryOffset, littleEndian)
    if (tag === 0x0112) {
      const value = readUint16(payload, entryOffset + 8, littleEndian)
      return { recognized: true, orientation: value }
    }
  }
  return { recognized: true, orientation: null } // valid Exif, no orientation tag = default (1)
}

/**
 * Strips the EXIF (APP1) segment from a JPEG only when provably safe:
 * the segment is a recognised Exif/TIFF structure AND its Orientation tag
 * is absent or 1 (normal). Scan data (SOS onward) is never inspected or
 * modified. Any assumption violation returns the input bytes unchanged.
 */
export function stripJpegExifIfSafe(bytes) {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) {
      return { bytes, stripped: false, reason: 'NOT_JPEG' }
    }

    const keepChunks = [bytes.subarray(0, 2)] // SOI
    let offset = 2
    let strippedAny = false

    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xff) {
        return { bytes, stripped: false, reason: 'PARSE_UNEXPECTED' }
      }
      const marker = bytes[offset + 1]

      if (marker === SOS) {
        keepChunks.push(bytes.subarray(offset))
        if (!strippedAny) return { bytes, stripped: false, reason: 'NO_STRIPPABLE_EXIF' }
        let total = 0
        for (const chunk of keepChunks) total += chunk.length
        const out = new Uint8Array(total)
        let pos = 0
        for (const chunk of keepChunks) {
          out.set(chunk, pos)
          pos += chunk.length
        }
        return { bytes: out, stripped: true, reason: 'EXIF_STRIPPED' }
      }

      if (UNEXPECTED_BEFORE_SOS.has(marker) || isRestartMarker(marker)) {
        return { bytes, stripped: false, reason: 'PARSE_UNEXPECTED' }
      }

      if (offset + 4 > bytes.length) return { bytes, stripped: false, reason: 'PARSE_TRUNCATED' }
      const segLength = readUint16(bytes, offset + 2, false) // segment length is always big-endian
      const segTotal = 2 + segLength
      if (segLength < 2 || offset + segTotal > bytes.length) {
        return { bytes, stripped: false, reason: 'PARSE_TRUNCATED' }
      }

      if (marker === APP1) {
        const payload = bytes.subarray(offset + 4, offset + segTotal)
        const { recognized, orientation } = parseExifOrientation(payload)
        const safeToStrip = recognized && (orientation === null || orientation === 1)
        if (safeToStrip) {
          strippedAny = true
          offset += segTotal
          continue
        }
      }

      keepChunks.push(bytes.subarray(offset, offset + segTotal))
      offset += segTotal
    }

    return { bytes, stripped: false, reason: 'PARSE_NO_SOS' }
  } catch {
    return { bytes, stripped: false, reason: 'PARSE_ERROR' }
  }
}

/** bytes-in/bytes-out — dispatches by mime type, only JPEG is currently handled. */
export function optimizeImageBytes({ bytes, mimeType }) {
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/jpg') {
    return { bytes, optimized: false, reason: 'UNSUPPORTED_FORMAT' }
  }
  const { bytes: out, stripped, reason } = stripJpegExifIfSafe(bytes)
  return { bytes: out, optimized: stripped, reason }
}

/** File-in/File-out convenience wrapper — preserves name/type/lastModified. */
export async function optimizeImageFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { bytes: out, optimized, reason } = optimizeImageBytes({ bytes, mimeType: file.type })
  if (!optimized) return { file, optimized: false, reason, savedBytes: 0 }
  const optimizedFile = new File([out], file.name, { type: file.type, lastModified: file.lastModified })
  return { file: optimizedFile, optimized: true, reason, savedBytes: file.size - optimizedFile.size }
}
