import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applySuggestionToNote,
  clearNoteSuggestionState,
  emptySuggestionState,
  emptyVaultNote,
  encodeVaultNote,
  parseVaultNote,
  suggestionSampleLine,
  vaultNoteToFile,
} from '../src/lib/vaultNote.js'

describe('vault notes', () => {
  it('round-trips title, tags, summary, and body', () => {
    const encoded = encodeVaultNote({
      title: 'Garden fence',
      tags: ['Home', 'home', 'todo'],
      summary: 'Call Jordan.',
      body: 'Measure the back fence Saturday.',
    })
    const parsed = parseVaultNote(encoded)
    assert.equal(parsed.title, 'Garden fence')
    assert.deepEqual(parsed.tags, ['home', 'todo'])
    assert.equal(parsed.summary, 'Call Jordan.')
    assert.equal(parsed.body, 'Measure the back fence Saturday.')
  })

  it('ignores ordinary JSON files', () => {
    assert.equal(parseVaultNote('{"title":"x"}'), null)
  })

  it('Accept writes suggestion fields into the note without dropping the body', () => {
    const note = applySuggestionToNote(
      { title: '', tags: [], summary: '', body: 'Need porch paint.' },
      { title: 'Porch paint', tags: ['home'], summary: 'Buy paint this weekend.' },
    )
    assert.equal(note.title, 'Porch paint')
    assert.deepEqual(note.tags, ['home'])
    assert.equal(note.summary, 'Buy paint this weekend.')
    assert.equal(note.body, 'Need porch paint.')
  })

  it('builds an encryptable JSON file for the existing store path', async () => {
    const file = vaultNoteToFile({
      title: 'Porch paint',
      tags: ['home'],
      summary: 'Buy paint.',
      body: 'One gallon, off-white.',
    })
    assert.equal(file.type, 'application/json')
    assert.match(file.name, /Porch paint\.json/)
    const parsed = parseVaultNote(await file.text())
    assert.equal(parsed.title, 'Porch paint')
  })

  it('exports a local JSONL sample without uploading', () => {
    const line = suggestionSampleLine({
      title: 'Porch paint',
      tags: ['home'],
      summary: 'Buy paint.',
      body: 'Need a gallon of porch paint.',
    })
    const row = JSON.parse(line)
    assert.equal(row.input, 'Need a gallon of porch paint.')
    assert.equal(row.output.title, 'Porch paint')
    assert.deepEqual(row.output.tags, ['home'])
    assert.doesNotMatch(line, /openai|anthropic|huggingface/i)
  })

  it('clears suggestion plaintext on lock', () => {
    let note = { title: 'secret', tags: ['a'], summary: 's', body: 'plaintext' }
    let tagInput = 'a'
    let suggestion = { title: 'secret', tags: ['a'], summary: 's' }
    let error = 'x'
    let busy = true
    const abortRef = { current: { abort() { this.aborted = true } } }
    clearNoteSuggestionState({
      abortRef,
      setNote: (value) => { note = value },
      setTagInput: (value) => { tagInput = value },
      setSuggestion: (value) => { suggestion = value },
      setError: (value) => { error = value },
      setBusy: (value) => { busy = value },
    })
    assert.deepEqual(note, emptyVaultNote())
    assert.equal(tagInput, '')
    assert.equal(suggestion, null)
    assert.equal(error, '')
    assert.equal(busy, false)
    assert.equal(abortRef.current, null)
    assert.deepEqual(emptySuggestionState(), { suggestion: null, error: '', busy: false })
  })
})
