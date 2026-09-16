import { clipSuggestionSummary, clipSuggestionTitle } from './ollamaLocal.js'
import { sanitizeFileName } from './security.js'

export const VAULT_NOTE_KIND = 'arkive-note'
export const VAULT_NOTE_VERSION = 1
export const MAX_NOTE_BODY_CHARS = 100_000

export function emptyVaultNote() {
  return { title: '', tags: [], summary: '', body: '' }
}

export function emptySuggestionState() {
  return { suggestion: null, error: '', busy: false }
}

export function clearNoteSuggestionState({ abortRef, setNote, setTagInput, setSuggestion, setError, setBusy }) {
  abortRef?.current?.abort()
  if (abortRef) abortRef.current = null
  setNote?.(emptyVaultNote())
  setTagInput?.('')
  setSuggestion?.(null)
  setError?.('')
  setBusy?.(false)
}

export function normalizeNoteTags(tags) {
  const source = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(/[,#]/)
      : []
  const seen = new Set()
  const out = []
  for (const raw of source) {
    const tag = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 8) break
  }
  return out
}

export function encodeVaultNote(note) {
  return JSON.stringify({
    kind: VAULT_NOTE_KIND,
    version: VAULT_NOTE_VERSION,
    title: clipSuggestionTitle(note?.title),
    tags: normalizeNoteTags(note?.tags),
    summary: clipSuggestionSummary(note?.summary),
    body: String(note?.body || '').slice(0, MAX_NOTE_BODY_CHARS),
  })
}

export function parseVaultNote(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const obj = JSON.parse(trimmed)
    if (obj?.kind !== VAULT_NOTE_KIND) return null
    return {
      title: String(obj.title || ''),
      tags: normalizeNoteTags(obj.tags),
      summary: String(obj.summary || ''),
      body: String(obj.body || ''),
    }
  } catch {
    return null
  }
}

export function applySuggestionToNote(note, suggestion) {
  if (!suggestion?.title) return note
  return {
    title: clipSuggestionTitle(suggestion.title),
    tags: normalizeNoteTags(suggestion.tags),
    summary: clipSuggestionSummary(suggestion.summary),
    body: String(note?.body || ''),
  }
}

export function vaultNoteToFile(note) {
  const payload = encodeVaultNote(note)
  const name = `${sanitizeFileName(note?.title || 'untitled-note')}.json`
  return new File([payload], name, { type: 'application/json' })
}

export function isVaultNoteMime(fileType) {
  const type = (fileType || '').toLowerCase()
  return type === 'application/json' || type === 'text/plain' || type === 'text/markdown'
}

export function suggestionSampleLine(note) {
  return JSON.stringify({
    input: String(note?.body || ''),
    output: {
      title: clipSuggestionTitle(note?.title),
      tags: normalizeNoteTags(note?.tags),
      summary: clipSuggestionSummary(note?.summary),
    },
  })
}

export function downloadSuggestionSample(note) {
  const line = `${suggestionSampleLine(note)}\n`
  const blob = new Blob([line], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const a = document.createElement('a')
  a.href = url
  a.download = `arkive-label-sample-${stamp}.jsonl`
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export function decodeVaultBytesAsText(bytes, maxChars = MAX_NOTE_BODY_CHARS + 2048) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''
  const sliced = bytes.length > maxChars * 4 ? bytes.subarray(0, maxChars * 4) : bytes
  return new TextDecoder().decode(sliced).slice(0, maxChars)
}
