import {
  assertLocalOllamaUrl,
  assertOllamaModelName,
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_MODEL,
} from './ollamaLocal.js'

const ENDPOINT_KEY = 'arkive.ollama.endpoint'
const MODEL_KEY = 'arkive.ollama.model'
const ENABLED_KEY = 'arkive.ollama.enabled'
const SAMPLE_COUNT_KEY = 'arkive.ollama.exportedSamples'

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadOllamaSettings() {
  const store = storage()
  const rawEndpoint = store?.getItem(ENDPOINT_KEY) || DEFAULT_OLLAMA_ENDPOINT
  const rawModel = store?.getItem(MODEL_KEY) || DEFAULT_OLLAMA_MODEL
  try {
    return {
      endpoint: assertLocalOllamaUrl(rawEndpoint),
      model: assertOllamaModelName(rawModel),
      enabled: store?.getItem(ENABLED_KEY) !== 'false',
    }
  } catch {
    return {
      endpoint: DEFAULT_OLLAMA_ENDPOINT,
      model: DEFAULT_OLLAMA_MODEL,
      enabled: store?.getItem(ENABLED_KEY) !== 'false',
    }
  }
}

export function saveOllamaSettings({ endpoint, model, enabled }) {
  const next = {
    endpoint: assertLocalOllamaUrl(endpoint),
    model: assertOllamaModelName(model),
    enabled: enabled !== false,
  }
  const store = storage()
  store?.setItem(ENDPOINT_KEY, next.endpoint)
  store?.setItem(MODEL_KEY, next.model)
  store?.setItem(ENABLED_KEY, next.enabled ? 'true' : 'false')
  return next
}

export function clearOllamaSettings() {
  const store = storage()
  store?.removeItem(ENDPOINT_KEY)
  store?.removeItem(MODEL_KEY)
  store?.removeItem(ENABLED_KEY)
}

export function exportedSampleCount() {
  const n = Number(storage()?.getItem(SAMPLE_COUNT_KEY) || 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function bumpExportedSampleCount() {
  const store = storage()
  const n = exportedSampleCount() + 1
  store?.setItem(SAMPLE_COUNT_KEY, String(n))
  return n
}
