import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  escapeHtml,
  validateArweaveTxId,
  validateSealFile,
  validateSealFileDeep,
  assertSafeFileHeader,
  assertNoActiveContent,
  assertValidImageMagic,
  validatePostImage,
  validatePostImageDeep,
  validateSponsorPayload,
  sanitizeFileName,
  assertVaultPayloadOwnership,
  validatePostText,
  isValidEthAddress,
  normalizeEthAddress,
  needsDownloadWarning,
} from '../src/lib/security.js'

const OWNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('security.js', () => {
  it('validates arweave tx ids', () => {
    const id = 'a'.repeat(43)
    assert.equal(validateArweaveTxId(id), id)
    assert.throws(() => validateArweaveTxId('short'), /INVALID_ARWEAVE_ID/)
    assert.throws(() => validateArweaveTxId('https://evil.com/x'), /INVALID_ARWEAVE_ID/)
  })

  it('sanitizes filenames', () => {
    const safe = sanitizeFileName('../../../etc/passwd')
    assert.ok(!safe.includes('/'))
    assert.ok(!safe.includes('..'))
    assert.equal(sanitizeFileName(''), 'arkive-record')
  })

  it('escapes html for print documents', () => {
    assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
    assert.equal(escapeHtml('a"b'), 'a&quot;b')
  })

  it('blocks executable vault files', () => {
    const exe = new File([new Uint8Array([1, 2, 3])], 'malware.exe', { type: 'application/octet-stream' })
    assert.throws(() => validateSealFile(exe), /FILE_TYPE_BLOCKED/)
  })

  it('blocks PE magic bytes disguised as pdf', () => {
    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
    assert.throws(
      () => assertSafeFileHeader(pe, 'doc.pdf', 'application/pdf'),
      /FILE_TYPE_BLOCKED/,
    )
  })

  it('requires allowed extension when mime is empty', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF only — too short for pdf check
    assert.throws(
      () => assertSafeFileHeader(bytes, 'mystery.bin', ''),
      /UNKNOWN_FILE_TYPE/,
    )
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
    assert.doesNotThrow(() => assertSafeFileHeader(pdfBytes, 'ok.pdf', ''))
  })

  it('deep-validates file headers async', async () => {
    const pdf = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
      'test.pdf',
      { type: 'application/pdf' },
    )
    await validateSealFileDeep(pdf)
  })

  it('flags download warning for non-preview types', () => {
    assert.equal(needsDownloadWarning('application/zip'), true)
    assert.equal(needsDownloadWarning('image/png'), false)
    assert.equal(needsDownloadWarning('application/pdf'), false)
  })

  it('enforces vault owner on payload', () => {
    const payload = {
      schema: 'ARKIVE_DUAL_ENCRYPTED_VAULT_FILE',
      encryptedByWallet: OWNER,
    }
    assert.throws(
      () => assertVaultPayloadOwnership(payload, OTHER),
      /NOT_VAULT_OWNER/,
    )
  })

  it('validates post text bounds', () => {
    assert.equal(validatePostText('hello'), 'hello')
    assert.throws(() => validatePostText('   '), /EMPTY_POST/)
    assert.throws(() => validatePostText('x'.repeat(2001)), /POST_TOO_LONG/)
  })

  it('validates eth addresses', () => {
    assert.ok(isValidEthAddress(OWNER))
    assert.equal(normalizeEthAddress(OWNER), OWNER.toLowerCase())
  })

  it('blocks svg post images via blocked mime prefixes', () => {
    const svg = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' })
    assert.throws(() => validatePostImage(svg), /FILE_TYPE_BLOCKED/)
  })

  it('blocks non-allowlisted image mime types', () => {
    const bmp = new File([new Uint8Array(8)], 'photo.bmp', { type: 'image/bmp' })
    assert.throws(() => validatePostImage(bmp), /FILE_TYPE_BLOCKED/)
  })

  it('rejects html magic bytes disguised as png', () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script>')
    assert.throws(() => assertNoActiveContent(html), /FILE_TYPE_BLOCKED/)
    assert.throws(
      () => assertValidImageMagic(html, 'image/png'),
      /FILE_TYPE_BLOCKED/,
    )
  })

  it('accepts png magic bytes for feed images', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    assert.doesNotThrow(() => assertValidImageMagic(png, 'image/png'))
  })

  it('deep-validates post image headers async', async () => {
    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
      'photo.png',
      { type: 'image/png' },
    )
    await validatePostImageDeep(png)
  })

  it('validates sponsor payload content types and byte count', () => {
    const json = new TextEncoder().encode('{"text":"hi"}')
    assert.doesNotThrow(() => validateSponsorPayload(json, 'application/json', json.length))

    assert.throws(
      () => validateSponsorPayload(json, 'text/html', json.length),
      /CONTENT_TYPE_BLOCKED/,
    )
    assert.throws(
      () => validateSponsorPayload(json, 'application/json', json.length + 1),
      /BYTE_COUNT_MISMATCH/,
    )

    const html = new TextEncoder().encode('<html>evil</html>')
    assert.throws(
      () => validateSponsorPayload(html, 'application/json', html.length),
      /FILE_TYPE_BLOCKED/,
    )
  })
})
