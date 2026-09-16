import { useState } from 'react'
import {
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_MODEL,
  OLLAMA_START_HINT,
  modelListIncludes,
  ollamaErrorMessage,
  pingOllama,
} from '../lib/ollamaLocal'
import { exportedSampleCount, loadOllamaSettings, saveOllamaSettings } from '../lib/ollamaSettings'

export default function OllamaSettings() {
  const saved = loadOllamaSettings()
  const [endpoint, setEndpoint] = useState(saved.endpoint)
  const [model, setModel] = useState(saved.model)
  const [enabled, setEnabled] = useState(saved.enabled)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [checking, setChecking] = useState(false)
  const [sampleCount] = useState(() => exportedSampleCount())

  function handleSave(event) {
    event.preventDefault()
    try {
      const next = saveOllamaSettings({ endpoint, model, enabled })
      setEndpoint(next.endpoint)
      setModel(next.model)
      setEnabled(next.enabled)
      setInvalid(false)
      setMessage(
        next.enabled
          ? `Saved. Suggestions use ${next.model} at ${next.endpoint}.`
          : 'Saved. Local suggestions are off until you enable them.',
      )
    } catch (error) {
      setInvalid(true)
      setMessage(ollamaErrorMessage(error))
    }
  }

  async function handleCheck() {
    setChecking(true)
    setStatus('')
    try {
      const next = {
        endpoint: endpoint.trim() || DEFAULT_OLLAMA_ENDPOINT,
        model: model.trim() || DEFAULT_OLLAMA_MODEL,
      }
      const health = await pingOllama({ endpoint: next.endpoint })
      if (modelListIncludes(health.models, next.model || DEFAULT_OLLAMA_MODEL)) {
        setStatus(`Ollama is running. Model ${next.model} is available.`)
      } else if (health.models.length === 0) {
        setStatus(OLLAMA_START_HINT)
      } else {
        setStatus(OLLAMA_START_HINT)
      }
    } catch (error) {
      setStatus(ollamaErrorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="panel p-6" aria-labelledby="ollama-settings-title">
      <h2 id="ollama-settings-title" className="font-display text-sm font-semibold text-ink mb-1">
        Local suggestions (Ollama)
      </h2>
      <p className="text-muted text-sm leading-relaxed mb-4">
        Title and tag suggestions run on your Mac. Each user runs Ollama locally — this is not cloud inference.
        The app refuses any endpoint that is not 127.0.0.1 or localhost on port 11434.
      </p>
      <form className="space-y-4" onSubmit={handleSave}>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked)
              setMessage('')
            }}
          />
          <span>
            Enable local suggestions
            <span className="block text-xs text-faint mt-1">Off means the Suggest button will not call Ollama.</span>
          </span>
        </label>
        <div>
          <label htmlFor="ollama-endpoint" className="block text-xs text-muted mb-1.5">
            Endpoint
          </label>
          <input
            id="ollama-endpoint"
            className="input-field font-mono text-sm"
            value={endpoint}
            onChange={(event) => {
              setEndpoint(event.target.value)
              setMessage('')
              setInvalid(false)
            }}
            spellCheck="false"
            autoComplete="off"
            aria-invalid={invalid}
          />
        </div>
        <div>
          <label htmlFor="ollama-model" className="block text-xs text-muted mb-1.5">
            Model
          </label>
          <input
            id="ollama-model"
            className="input-field font-mono text-sm"
            value={model}
            onChange={(event) => {
              setModel(event.target.value)
              setMessage('')
            }}
            spellCheck="false"
            autoComplete="off"
          />
          <p className="text-[11px] text-faint mt-2">
            Default is {DEFAULT_OLLAMA_MODEL} at {DEFAULT_OLLAMA_ENDPOINT}. After a local fine-tune, switch to arkive-labels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-secondary btn-primary-sm">
            Save local model
          </button>
          <button type="button" className="btn-secondary btn-primary-sm" onClick={handleCheck} disabled={checking}>
            {checking ? 'Checking…' : 'Check Ollama'}
          </button>
        </div>
        {message && (
          <p role="status" className={`text-sm leading-relaxed ${invalid ? 'text-amber-200' : 'text-muted'}`}>
            {message}
          </p>
        )}
        {status && (
          <p role="status" className="text-sm text-muted leading-relaxed">
            {status}
          </p>
        )}
        <p className="text-[11px] text-faint">
          {sampleCount} suggestion sample{sampleCount === 1 ? '' : 's'} exported in this browser.
          Collect 20–50 corrected examples before training. Never commit real secrets.
        </p>
      </form>
    </section>
  )
}
