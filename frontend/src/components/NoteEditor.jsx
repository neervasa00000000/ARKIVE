import { useEffect, useRef, useState } from 'react'
import { Lock, Sparkles, FileLock2, Download } from 'lucide-react'
import { useVault } from '../hooks/useVault'
import { isDemoMode } from '../config/demo'
import { useDemoVault } from '../context/DemoVaultContext'
import { vaultErrorMessage } from '../lib/setupStatus'
import { bumpExportedSampleCount, loadOllamaSettings } from '../lib/ollamaSettings'
import { ollamaErrorMessage, suggestNoteLabels } from '../lib/ollamaLocal'
import {
  applySuggestionToNote,
  clearNoteSuggestionState,
  downloadSuggestionSample,
  emptyVaultNote,
  normalizeNoteTags,
  vaultNoteToFile,
} from '../lib/vaultNote'
import { Modal, ModalHeader, ModalBody } from './Modal'
import toast from 'react-hot-toast'

function tagsToInput(tags) {
  return Array.isArray(tags) ? tags.join(', ') : ''
}

export function UnlockedNotePane({ initialNote, onLock, onSaved, showSave = true }) {
  const { storeFile, loading, step, SignPromptModal } = useVault()
  const demoVault = useDemoVault()
  const abortRef = useRef(null)
  const titleRef = useRef(null)
  const [note, setNote] = useState(() => ({ ...emptyVaultNote(), ...initialNote }))
  const [tagInput, setTagInput] = useState(() => tagsToInput(initialNote?.tags))
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => () => {
    clearNoteSuggestionState({ abortRef, setNote, setTagInput, setSuggestion, setError, setBusy })
  }, [])

  function lock() {
    clearNoteSuggestionState({ abortRef, setNote, setTagInput, setSuggestion, setError, setBusy })
    onLock?.()
  }

  function currentDraft() {
    return { ...note, tags: normalizeNoteTags(tagInput) }
  }

  async function handleSuggest() {
    const settings = loadOllamaSettings()
    if (!settings.enabled) {
      setError(ollamaErrorMessage({ code: 'OLLAMA_DISABLED' }))
      return
    }
    const body = note.body.trim()
    if (!body) {
      setError(ollamaErrorMessage({ code: 'OLLAMA_EMPTY_NOTE' }))
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError('')
    setSuggestion(null)
    try {
      const next = await suggestNoteLabels({
        noteText: body,
        endpoint: settings.endpoint,
        model: settings.model,
        enabled: settings.enabled,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setSuggestion(next)
    } catch (suggestError) {
      if (controller.signal.aborted || suggestError?.name === 'AbortError') return
      setSuggestion(null)
      setError(ollamaErrorMessage(suggestError))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
    }
  }

  function applyDraft(closePanel) {
    if (!suggestion) return
    const next = applySuggestionToNote(currentDraft(), suggestion)
    setNote(next)
    setTagInput(tagsToInput(next.tags))
    if (closePanel) setSuggestion(null)
    return next
  }

  function handleAccept() {
    applyDraft(true)
  }

  function handleEdit() {
    applyDraft(true)
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  function handleExportSample() {
    const draft = currentDraft()
    if (!draft.body.trim() || !draft.title.trim()) {
      setError('Add a title and note, then export. Nothing is uploaded.')
      return
    }
    downloadSuggestionSample(draft)
    const n = bumpExportedSampleCount()
    toast.success(`Downloaded local JSONL sample (${n} in this browser). Not uploaded.`)
  }

  async function handleSave() {
    const draft = currentDraft()
    if (!draft.body.trim() && !draft.title.trim()) {
      setError('Write a title or note before encrypting.')
      return
    }
    const file = vaultNoteToFile(draft)
    try {
      if (isDemoMode) {
        demoVault.addRecord(file)
        toast.success('Note sealed in demo vault')
      } else {
        await storeFile(file)
        toast.success('Note encrypted and stored')
      }
      clearNoteSuggestionState({ abortRef, setNote, setTagInput, setSuggestion, setError, setBusy })
      onSaved?.()
    } catch (saveError) {
      setError(vaultErrorMessage(saveError))
    }
  }

  return (
    <>
      {SignPromptModal}
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div>
            <label htmlFor="arkive-note-title" className="block text-xs text-muted mb-1.5">Title</label>
            <input
              id="arkive-note-title"
              ref={titleRef}
              className="input-field"
              value={note.title}
              maxLength={80}
              onChange={(event) => setNote({ ...note, title: event.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="arkive-note-tags" className="block text-xs text-muted mb-1.5">Tags</label>
            <input
              id="arkive-note-tags"
              className="input-field"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="travel, receipts"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="arkive-note-summary" className="block text-xs text-muted mb-1.5">Summary</label>
            <input
              id="arkive-note-summary"
              className="input-field"
              value={note.summary}
              onChange={(event) => setNote({ ...note, summary: event.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="arkive-note-body" className="block text-xs text-muted mb-1.5">Note</label>
            <textarea
              id="arkive-note-body"
              className="input-field min-h-[10rem] resize-y"
              value={note.body}
              onChange={(event) => setNote({ ...note, body: event.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary btn-primary-sm"
              onClick={handleSuggest}
              disabled={busy || !note.body.trim()}
              aria-busy={busy}
            >
              <Sparkles size={15} />
              {busy ? 'Suggesting…' : 'Suggest title & tags'}
            </button>
            <p className="text-[11px] text-faint">Local Ollama only. Sends this note on click, not the rest of the vault.</p>
          </div>
        </form>

        {error && (
          <p role="alert" className="text-sm text-amber-200 leading-relaxed">
            {error}
          </p>
        )}

        {suggestion && (
          <div className="notice-inline space-y-3" role="status">
            <p className="font-display text-sm text-ink">Suggested</p>
            <div>
              <label htmlFor="arkive-suggest-title" className="block text-xs text-muted mb-1.5">Title</label>
              <input
                id="arkive-suggest-title"
                className="input-field"
                value={suggestion.title}
                maxLength={80}
                onChange={(event) => setSuggestion({ ...suggestion, title: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="arkive-suggest-tags" className="block text-xs text-muted mb-1.5">Tags</label>
              <input
                id="arkive-suggest-tags"
                className="input-field"
                value={tagsToInput(suggestion.tags)}
                onChange={(event) => setSuggestion({ ...suggestion, tags: normalizeNoteTags(event.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="arkive-suggest-summary" className="block text-xs text-muted mb-1.5">Summary</label>
              <textarea
                id="arkive-suggest-summary"
                className="input-field min-h-[4.5rem] resize-y"
                value={suggestion.summary}
                onChange={(event) => setSuggestion({ ...suggestion, summary: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary btn-primary-sm" onClick={handleAccept}>
                Accept
              </button>
              <button type="button" className="btn-secondary btn-primary-sm" onClick={handleEdit}>
                Edit
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSuggestion(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={handleExportSample}>
            <Download size={15} />
            Export suggestion sample (local)
          </button>
          <button type="button" className="btn-ghost" onClick={lock}>
            <Lock size={15} />
            Lock
          </button>
          {showSave && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={loading || busy}
            >
              {loading ? (step || 'Encrypting…') : 'Encrypt & store'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default function NoteEditorModal({ initialNote, onClose, onSaved }) {
  return (
    <Modal onClose={onClose} size="max-w-2xl">
      <ModalHeader
        title={initialNote?.title?.trim() || 'Unlocked note'}
        description="Suggestions run on Ollama on this Mac. Nothing is sent to cloud LLM providers."
        onClose={onClose}
        icon={FileLock2}
      />
      <ModalBody>
        <UnlockedNotePane
          initialNote={initialNote}
          onLock={onClose}
          onSaved={() => {
            onSaved?.()
            onClose?.()
          }}
        />
      </ModalBody>
    </Modal>
  )
}
