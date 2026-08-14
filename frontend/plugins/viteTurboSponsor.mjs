/**
 * Dev-only: spawn turboSponsor.mjs alongside Vite so /api/turbo proxy works with `npm run dev`.
 */
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPONSOR_SCRIPT = resolve(__dirname, '../server/turboSponsor.mjs')
const DEFAULT_PORT = 8787

function waitForHealth(port, attempts = 40, intervalMs = 250) {
  const url = `http://127.0.0.1:${port}/api/turbo/health`
  return new Promise((resolveWait, reject) => {
    let tries = 0
    const tick = async () => {
      tries++
      try {
        const res = await fetch(url)
        if (res.ok) {
          resolveWait()
          return
        }
      } catch {
        /* sponsor still starting */
      }
      if (tries >= attempts) {
        reject(new Error(`health check failed on :${port}`))
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

export function viteTurboSponsor() {
  let child = null
  const port = Number(process.env.SPONSOR_PORT || DEFAULT_PORT)

  async function ensureSponsorReady() {
    try {
      await waitForHealth(port, 48, 250)
      console.info('[ARKIVE sponsor] ready on port', port, '— proxy /api/turbo →', `http://127.0.0.1:${port}`)
      return true
    } catch {
      return false
    }
  }

  return {
    name: 'vite-turbo-sponsor',
    apply: 'serve',
    async configureServer() {
      // Wait for an existing sponsor (e.g. `npm run sponsor-server`) before spawning — avoids EADDRINUSE races.
      if (await ensureSponsorReady()) return
      if (child) return

      console.info('[ARKIVE sponsor] starting turbo sponsor on port', port)
      child = spawn(process.execPath, [SPONSOR_SCRIPT], {
        stdio: 'inherit',
        env: { ...process.env, SPONSOR_PORT: String(port) },
      })

      child.on('error', (err) => {
        console.error('[ARKIVE sponsor] failed to start:', err.message)
      })

      child.on('exit', (code, signal) => {
        if (code != null && code !== 0) {
          console.warn('[ARKIVE sponsor] exited', { code, signal })
        }
        child = null
      })

      if (!(await ensureSponsorReady())) {
        console.warn(
          '[ARKIVE sponsor] health check failed — feed sponsor fallback may fail until server is up',
        )
      }
    },
    closeBundle() {
      if (child && !child.killed) {
        child.kill('SIGTERM')
        child = null
      }
    },
  }
}
