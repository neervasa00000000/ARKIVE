import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertLocalOllamaUrl,
  assertOllamaModelName,
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_MODEL,
  OLLAMA_START_HINT,
  ollamaErrorMessage,
  parseSuggestionJson,
  pingOllama,
  suggestNoteLabels,
} from '../src/lib/ollamaLocal.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('local Ollama firewall', () => {
  it('accepts only loopback :11434', () => {
    assert.equal(assertLocalOllamaUrl('http://127.0.0.1:11434'), DEFAULT_OLLAMA_ENDPOINT)
    assert.equal(assertLocalOllamaUrl('http://127.0.0.1:11434/'), DEFAULT_OLLAMA_ENDPOINT)
    assert.equal(assertLocalOllamaUrl('127.0.0.1:11434'), DEFAULT_OLLAMA_ENDPOINT)
    assert.equal(assertLocalOllamaUrl('127.0.0.1'), DEFAULT_OLLAMA_ENDPOINT)
    assert.equal(assertLocalOllamaUrl('http://127.0.0.1'), DEFAULT_OLLAMA_ENDPOINT)
    assert.equal(assertLocalOllamaUrl('http://localhost:11434'), DEFAULT_OLLAMA_ENDPOINT)
    assert.equal(assertLocalOllamaUrl('localhost:11434'), DEFAULT_OLLAMA_ENDPOINT)
  })

  it('rejects non-localhost and cloud LLM hosts', () => {
    const blocked = [
      'https://127.0.0.1:11434',
      'http://127.0.0.1:11435',
      'http://0.0.0.0:11434',
      'http://[::1]:11434',
      'https://api.openai.com/v1/chat/completions',
      'https://api.anthropic.com/v1/messages',
      'https://generativelanguage.googleapis.com',
      'http://openai.com',
      'http://127.0.0.1.attacker.com:11434',
      'http://127.0.0.1:11434/../../etc/passwd',
      'http://user:pass@127.0.0.1:11434',
    ]
    for (const url of blocked) {
      assert.throws(() => assertLocalOllamaUrl(url), /OLLAMA_ENDPOINT_NOT_LOCAL/, url)
    }
  })

  it('allows only safe local model names', () => {
    assert.equal(assertOllamaModelName('qwen2.5:7b'), DEFAULT_OLLAMA_MODEL)
    assert.equal(assertOllamaModelName('arkive-labels'), 'arkive-labels')
    assert.throws(() => assertOllamaModelName('http://evil'), /OLLAMA_BAD_MODEL/)
    assert.throws(() => assertOllamaModelName('openai/gpt-4'), /OLLAMA_BAD_MODEL/)
  })

  it('parses model JSON even when fenced', () => {
    const out = parseSuggestionJson('```json\n{"title":"Garden fence","tags":["home","todo"],"summary":"Call Jordan."}\n```')
    assert.equal(out.title, 'Garden fence')
    assert.deepEqual(out.tags, ['home', 'todo'])
    assert.equal(out.summary, 'Call Jordan.')
    const long = parseSuggestionJson(`{"title":"${'A'.repeat(90)}","tags":["home"],"summary":"One. Two. Three."}`)
    assert.equal(long.title.length, 80)
    assert.equal(long.summary, 'One. Two.')
  })

  it('never fetches a remote URL for suggest or ping', async () => {
    const seen = []
    const fetchImpl = async (url) => {
      seen.push(String(url))
      throw new Error('network down')
    }
    await assert.rejects(
      () => suggestNoteLabels({
        noteText: 'Buy paint for the porch',
        endpoint: 'https://api.openai.com',
        fetchImpl,
      }),
      /OLLAMA_ENDPOINT_NOT_LOCAL/,
    )
    assert.deepEqual(seen, [])
  })

  it('shows a clear error when Ollama is down and does not hang on health check', async () => {
    const fetchImpl = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new TypeError('Failed to fetch')
    }
    const started = Date.now()
    await assert.rejects(
      () => pingOllama({ fetchImpl }),
      (error) => error.code === 'OLLAMA_UNREACHABLE',
    )
    assert.ok(Date.now() - started < 2000)
    assert.equal(ollamaErrorMessage({ code: 'OLLAMA_UNREACHABLE' }), OLLAMA_START_HINT)
  })

  it('aborts a hung health check in about 400ms', async () => {
    const fetchImpl = (_url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
    const started = Date.now()
    await assert.rejects(
      () => pingOllama({ fetchImpl }),
      (error) => error.code === 'OLLAMA_TIMEOUT',
    )
    const elapsed = Date.now() - started
    assert.ok(elapsed >= 300, elapsed)
    assert.ok(elapsed < 1200, elapsed)
  })

  it('refuses a disabled Suggest path before any fetch', async () => {
    const seen = []
    await assert.rejects(
      () => suggestNoteLabels({
        noteText: 'Buy paint',
        enabled: false,
        fetchImpl: async (url) => { seen.push(url); throw new Error('nope') },
      }),
      (error) => error.code === 'OLLAMA_DISABLED',
    )
    assert.deepEqual(seen, [])
  })

  it('calls only 127.0.0.1:11434 generate after a local health check', async () => {
    const seen = []
    const fetchImpl = async (url, opts) => {
      seen.push({ url: String(url), method: opts.method, body: opts.body })
      const payload = url.endsWith('/api/tags')
        ? { models: [{ name: 'qwen2.5:7b' }] }
        : { response: '{"title":"Porch paint","tags":["home"],"summary":"Buy paint."}' }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '64' }),
        body: {
          getReader() {
            const encoded = new TextEncoder().encode(JSON.stringify(payload))
            let done = false
            return {
              async read() {
                if (done) return { done: true, value: undefined }
                done = true
                return { done: false, value: encoded }
              },
              async cancel() {},
              releaseLock() {},
            }
          },
        },
      }
    }
    const result = await suggestNoteLabels({
      noteText: 'Need a gallon of porch paint this weekend.',
      fetchImpl,
    })
    assert.equal(result.title, 'Porch paint')
    assert.deepEqual(result.tags, ['home'])
    assert.equal(seen.length, 2)
    assert.equal(seen[0].url, 'http://127.0.0.1:11434/api/tags')
    assert.equal(seen[1].url, 'http://127.0.0.1:11434/api/generate')
    assert.ok(!JSON.stringify(seen).includes('openai'))
    const generateBody = JSON.parse(seen[1].body)
    assert.equal(generateBody.model, 'qwen2.5:7b')
    assert.equal(generateBody.stream, false)
  })
})

describe('repo constraints for local Suggest', () => {
  it('does not require cloud LLM keys in .env.example', () => {
    const envExample = readFileSync(join(root, 'frontend/.env.example'), 'utf8')
    assert.equal(/\n(?:VITE_)?(OPENAI|ANTHROPIC|GEMINI)_API_KEY=/.test(envExample), false)
  })

  it('does not import cloud generative SDKs in app source', () => {
    const srcRoot = join(root, 'frontend/src')
    const files = []
    function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(js|jsx)$/.test(entry.name)) files.push(path)
      }
    }
    walk(srcRoot)
    const blocked = /from ['"](?:openai|@anthropic|@google\/generative-ai|@google\/genai|groq-sdk)['"]/
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      assert.equal(blocked.test(text), false, file)
    }
  })

  it('CSP allowlists only local Ollama', () => {
    const files = [
      'frontend/index.html',
      'frontend/vite.config.js',
      'frontend/vercel.json',
      'frontend/netlify.toml',
      'frontend/public/_headers',
    ]
    for (const rel of files) {
      const text = readFileSync(join(root, rel), 'utf8')
      assert.match(text, /http:\/\/127\.0\.0\.1:11434/)
      assert.doesNotMatch(text, /api\.openai\.com/)
    }
  })
})
