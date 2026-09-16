/**
 * Local Ollama client for ARKIVE label suggestions.
 * Inference only. Never used for training. No cloud LLM providers.
 */

import { readResponseBytes } from './boundedResponse.js'

export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434'
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b'
export const OLLAMA_START_HINT = 'Start Ollama locally. Run: ollama pull qwen2.5:7b'
export const MAX_SUGGESTION_TITLE = 80
export const MAX_SUGGESTION_TAGS = 8

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost'])
const ALLOWED_PORT = '11434'
const ALLOWED_PATHS = new Set(['/api/tags', '/api/generate', '/api/chat'])
const MAX_RESPONSE_BYTES = 256 * 1024
const MAX_NOTE_CHARS = 20_000
const HEALTH_TIMEOUT_MS = 400
const GENERATE_TIMEOUT_MS = 120_000

export class OllamaError extends Error {
  constructor(code) {
    super(code)
    this.name = 'OllamaError'
    this.code = code
  }
}

export function ollamaErrorMessage(error) {
  const code = error?.code || error?.message || ''
  if (
    code === 'OLLAMA_UNREACHABLE' ||
    code === 'OLLAMA_TIMEOUT' ||
    code === 'OLLAMA_MODEL_MISSING' ||
    code === 'OLLAMA_START_HINT'
  ) {
    return OLLAMA_START_HINT
  }
  if (code === 'OLLAMA_DISABLED') {
    return 'Turn on local suggestions in Profile.'
  }
  if (code === 'OLLAMA_ENDPOINT_NOT_LOCAL') {
    return 'Ollama must stay on this computer (http://127.0.0.1:11434 or http://localhost:11434).'
  }
  if (code === 'OLLAMA_BAD_MODEL') {
    return 'Model name can only use letters, numbers, dots, colons, underscores, and hyphens.'
  }
  if (code === 'OLLAMA_EMPTY_NOTE') {
    return 'Write the note first, then suggest title and tags.'
  }
  if (code === 'OLLAMA_BAD_JSON') {
    return 'The local model did not return usable title and tags. Try again.'
  }
  return OLLAMA_START_HINT
}

function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export function clipSuggestionTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SUGGESTION_TITLE)
}

export function clipSuggestionSummary(value) {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ')
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2)
  return sentences.join(' ').slice(0, 280)
}

/**
 * Hard firewall: only loopback :11434.
 * Accepts 127.0.0.1 or localhost; always returns http://127.0.0.1:11434 for fetch.
 */
export function assertLocalOllamaUrl(raw) {
  if (raw == null || typeof raw !== 'string') {
    throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  }
  const trimmed = raw.trim()
  if (!trimmed) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')

  let candidate = trimmed
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `http://${candidate}`
  }

  let parsed
  try {
    parsed = new URL(candidate)
  } catch {
    throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  }

  if (parsed.protocol !== 'http:') throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  if (parsed.username || parsed.password) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  const port = parsed.port || ALLOWED_PORT
  if (port !== ALLOWED_PORT) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  if (parsed.search || parsed.hash) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')

  const path = parsed.pathname === '/' ? '' : parsed.pathname
  if (path && !ALLOWED_PATHS.has(path)) {
    throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  }

  return `http://127.0.0.1:${ALLOWED_PORT}`
}

export function assertOllamaModelName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name || name.length > 80 || !/^[a-zA-Z0-9._:-]+$/.test(name)) {
    throw new OllamaError('OLLAMA_BAD_MODEL')
  }
  if (/https?:/i.test(name) || name.includes('/') || name.includes('\\')) {
    throw new OllamaError('OLLAMA_BAD_MODEL')
  }
  return name
}

export function parseSuggestionJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new OllamaError('OLLAMA_BAD_JSON')
  }
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new OllamaError('OLLAMA_BAD_JSON')

  let obj
  try {
    obj = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new OllamaError('OLLAMA_BAD_JSON')
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new OllamaError('OLLAMA_BAD_JSON')
  }

  const title = clipSuggestionTitle(obj.title)
  const summary = clipSuggestionSummary(obj.summary)
  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .map((tag) => String(tag || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32))
        .filter(Boolean)
        .slice(0, MAX_SUGGESTION_TAGS)
    : []

  if (!title) throw new OllamaError('OLLAMA_BAD_JSON')
  return { title, tags, summary }
}

function buildPrompt(noteText) {
  return [
    'You label a personal vault note.',
    'Return JSON only, no markdown, no extra keys:',
    '{"title":"...","tags":["..."],"summary":"..."}',
    'title: specific, at most 80 characters.',
    'tags: 1-8 lowercase keywords.',
    'summary: at most two sentences.',
    'Note:',
    noteText,
  ].join('\n')
}

function localRequestUrl(origin, path) {
  if (!ALLOWED_PATHS.has(path)) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  const url = `${stripTrailingSlash(origin)}${path}`
  const parsed = new URL(url)
  if (parsed.origin !== origin) throw new OllamaError('OLLAMA_ENDPOINT_NOT_LOCAL')
  assertLocalOllamaUrl(url)
  return url
}

function parseModelNames(text) {
  try {
    const payload = JSON.parse(text)
    if (!Array.isArray(payload?.models)) return []
    return payload.models
      .map((entry) => (typeof entry?.name === 'string' ? entry.name : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

export function modelListIncludes(models, modelName) {
  const wanted = String(modelName || '')
  return (models || []).some((name) => name === wanted)
}

async function ollamaFetch(url, { method, body, timeoutMs, signal, fetchImpl }) {
  assertLocalOllamaUrl(url)
  const doFetch = fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await doFetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      redirect: 'error',
    })
    const bytes = await readResponseBytes(response, MAX_RESPONSE_BYTES)
    const text = new TextDecoder().decode(bytes)
    return { ok: response.ok, status: response.status, text }
  } catch (error) {
    if (error?.name === 'AbortError') throw new OllamaError('OLLAMA_TIMEOUT')
    if (error instanceof OllamaError) throw error
    if (error?.message === 'RESPONSE_TOO_LARGE') throw new OllamaError('OLLAMA_BAD_JSON')
    throw new OllamaError('OLLAMA_UNREACHABLE')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function throwFromOllamaBody(status, text) {
  const lower = (text || '').toLowerCase()
  if (status === 404 || lower.includes('not found') || lower.includes('pull')) {
    throw new OllamaError('OLLAMA_MODEL_MISSING')
  }
  throw new OllamaError('OLLAMA_UNREACHABLE')
}

export async function pingOllama({ endpoint = DEFAULT_OLLAMA_ENDPOINT, fetchImpl, signal } = {}) {
  const origin = assertLocalOllamaUrl(endpoint)
  const url = localRequestUrl(origin, '/api/tags')
  const result = await ollamaFetch(url, {
    method: 'GET',
    timeoutMs: HEALTH_TIMEOUT_MS,
    fetchImpl,
    signal,
  })
  if (!result.ok) throw new OllamaError('OLLAMA_UNREACHABLE')
  const models = parseModelNames(result.text)
  return { ok: true, models }
}

export async function suggestNoteLabels({
  noteText,
  endpoint = DEFAULT_OLLAMA_ENDPOINT,
  model = DEFAULT_OLLAMA_MODEL,
  enabled = true,
  fetchImpl,
  signal,
} = {}) {
  if (enabled === false) throw new OllamaError('OLLAMA_DISABLED')
  const body = typeof noteText === 'string' ? noteText.trim() : ''
  if (!body) throw new OllamaError('OLLAMA_EMPTY_NOTE')

  const origin = assertLocalOllamaUrl(endpoint)
  const modelName = assertOllamaModelName(model)
  const clipped = body.slice(0, MAX_NOTE_CHARS)

  const health = await pingOllama({ endpoint: origin, fetchImpl, signal })
  if (health.models.length > 0 && !modelListIncludes(health.models, modelName)) {
    throw new OllamaError('OLLAMA_MODEL_MISSING')
  }

  const url = localRequestUrl(origin, '/api/generate')
  const result = await ollamaFetch(url, {
    method: 'POST',
    timeoutMs: GENERATE_TIMEOUT_MS,
    fetchImpl,
    signal,
    body: {
      model: modelName,
      prompt: buildPrompt(clipped),
      stream: false,
      format: 'json',
      options: { temperature: 0.2 },
    },
  })

  if (!result.ok) throwFromOllamaBody(result.status, result.text)

  let payload
  try {
    payload = JSON.parse(result.text)
  } catch {
    throw new OllamaError('OLLAMA_BAD_JSON')
  }
  return parseSuggestionJson(typeof payload?.response === 'string' ? payload.response : result.text)
}
