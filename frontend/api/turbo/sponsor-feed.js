import { handleSponsorFeed } from './_shared.mjs'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
}

let handlerPromise

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('./_shared.mjs')
  }
  return handlerPromise
}

export default async function handler(req, res) {
  try {
    const { handleSponsorFeed: run } = await getHandler()
    await run(req, res)
  } catch (error) {
    console.error('[sponsor-feed] init failed', error)
    res.status(500).json({ error: 'SPONSOR_INIT_FAILED', message: error?.message || String(error) })
  }
}
