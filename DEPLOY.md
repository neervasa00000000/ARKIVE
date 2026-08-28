# ARKIVE beta deployment

Minimal steps to run a live beta without a custom domain. Contracts are already on **Base Sepolia** (addresses in `frontend/src/config/contracts.js`).

**Current beta URLs (branded — share these):**

| Host | URL |
|------|-----|
| Vercel (preferred) | https://arkive-beta.vercel.app |
| Netlify (backup) | https://arkive-beta.netlify.app |

## Wallet apps: use a branded subdomain

Do **not** share random Netlify subdomains (e.g. `fantastic-fenglisu-eb993c.netlify.app`). MetaMask Blockaid and similar scanners treat unknown auto-generated subdomains as suspicious and may show **"Malicious site detected"** (false positive).

When deploying:

1. Rename the Netlify site to a branded name (`arkive-beta`, `arkive-app`, etc.) via [Netlify UI](https://app.netlify.com) → Site configuration → Site details, or `netlify api updateSite`.
2. On Vercel, use a named project (`arkive`) and alias like `arkive-beta.vercel.app` — not the default `frontend-xxx.vercel.app`.
3. Prefer a **custom domain** for production (best reputation signal).
4. Disable Vercel **Deployment Protection (SSO)** for public beta — wallet users cannot sign in through Vercel SSO.

**False positive?** Report to MetaMask: [security.metamask.io](https://security.metamask.io/) → submit site for review / false positive.

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
| `SPONSOR_ALLOWED_ORIGINS` | Yes | Comma-separated frontend URLs, e.g. `https://arkive-beta.vercel.app,https://arkive-beta.netlify.app` — **update whenever the frontend URL changes** |
| `BASE_SEPOLIA_RPC_URL` | No | Default `https://sepolia.base.org` |
| `PORT` | Auto | Set by host (Railway/Render). Falls back to `8787`. |

After deploy, set `VITE_SPONSOR_API_URL=https://your-sponsor-host` on the frontend and redeploy.

**Health check:** `GET /api/turbo/health` → `{ "ok": true, "sponsorConfigured": true }`

**Note:** Same-origin Vercel/Netlify `/api/turbo/*` functions also work when `DEPLOYER_PRIVATE_KEY` is set on the host. Pin `rpc-websockets` → `uuid@8.3.2` (see `package.json` overrides) so serverless does not crash with `ERR_REQUIRE_ESM`.

## 3. Verify beta

1. Open frontend URL, connect wallet on Base Sepolia.
2. Create a feed post — sponsor upload should succeed (wallet signs auth; server pays storage).
3. Vault upload uses wallet-funded Turbo path (separate from sponsor).

## Secrets checklist

- `.env`, `contracts/.env`, `frontend/.env` are gitignored — do not commit.
- Never prefix `DEPLOYER_PRIVATE_KEY` or `ARWEAVE_DEPLOY_KEY` with `VITE_`.
