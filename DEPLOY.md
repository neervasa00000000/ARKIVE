# ARKIVE beta deployment

Minimal steps to run a live beta without a custom domain. Contracts are already on **Base Sepolia** (addresses in `frontend/src/config/contracts.js`).

## 1. Frontend (Vercel or Netlify)

**Root directory:** `frontend`

| Variable | Value |
|----------|-------|
| `VITE_DEMO_MODE` | `false` |
| `VITE_WALLETCONNECT_PROJECT_ID` | From [WalletConnect Cloud](https://cloud.walletconnect.com) |
| `VITE_SPONSOR_API_URL` | Sponsor server URL from step 2 (no trailing slash) |

Contract addresses are baked into `contracts.js` — no `VITE_*` contract vars needed unless you redeploy.

Optional: `VITE_ARWEAVE_APP_TX`, `VITE_ARWEAVE_RECOVERY_TX` after permaweb deploy.

**Vercel:** Import repo, set root to `frontend`, add env vars, deploy. `vercel.json` handles SPA routing.

**Netlify:** Base directory `frontend`, build `npm run build`, publish `dist`. `netlify.toml` included.

**Build locally:** `cd frontend && VITE_DEMO_MODE=false npm run build`

## 2. Sponsor API (Railway, Render, or Fly.io)

The feed sponsor server pays Turbo storage when users lack credits. It must run separately — **never commit `DEPLOYER_PRIVATE_KEY`**.

**Start command:** `node server/turboSponsor.mjs`  
**Root directory:** `frontend`

| Variable | Required | Notes |
|----------|----------|-------|
| `DEPLOYER_PRIVATE_KEY` | Yes | Server-only. Fund with Base Sepolia ETH for Turbo. |
| `SPONSOR_ALLOWED_ORIGINS` | Yes | Comma-separated frontend URLs, e.g. `https://your-app.vercel.app` |
| `BASE_SEPOLIA_RPC_URL` | No | Default `https://sepolia.base.org` |
| `PORT` | Auto | Set by host (Railway/Render). Falls back to `8787`. |

After deploy, set `VITE_SPONSOR_API_URL=https://your-sponsor-host` on the frontend and redeploy.

**Health check:** `GET /api/turbo/health` → `{ "ok": true, "sponsorConfigured": true }`

## 3. Verify beta

1. Open frontend URL, connect wallet on Base Sepolia.
2. Create a feed post — sponsor upload should succeed (wallet signs auth; server pays storage).
3. Vault upload uses wallet-funded Turbo path (separate from sponsor).

## Secrets checklist

- `.env`, `contracts/.env`, `frontend/.env` are gitignored — do not commit.
- Never prefix `DEPLOYER_PRIVATE_KEY` or `ARWEAVE_DEPLOY_KEY` with `VITE_`.
