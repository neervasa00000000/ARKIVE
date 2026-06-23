# ARKIVE — Full Build Guide

Canonical source: `arkive/` in the NutriThrive Website repo. Preview deploy: `private/arkive-preview/` on Netlify.

## What ARKIVE Is

Web3 dApp MVP on **Base Sepolia** (chain ID `84532`).

| Feature | What it does | Storage | On-chain |
|---------|--------------|---------|----------|
| Feed | Public permanent posts (text or images) | Arweave | PostRegistry |
| Vault | Private encrypted file storage | Arweave (dual-encrypted) | VaultRegistry |
| Profile | Username + profile pic | Arweave (avatar) | UserRegistry |
| Points | Gamification (welcome, posts, likes) | — | PointsSystem |

- **Wallet:** MetaMask / RainbowKit (WalletConnect optional)
- **Encryption:** Lit Protocol (primary) + wallet signature derivation (fallback)
- **Permanent storage:** Arweave via Turbo SDK (`@ardrive/turbo-sdk`)

## Repository Layout

```
Website/
├── arkive/                          # Source (excluded from Netlify publish)
│   ├── docs/BUILD-GUIDE.md          # This file
│   ├── README.md
│   ├── .env.example
│   ├── contracts/                   # Hardhat Solidity project
│   └── frontend/                    # React + Vite app
├── private/arkive-preview/          # Built static files (committed, deployed)
├── scripts/build-arkive-preview.mjs
├── netlify.toml
├── .netlifyignore
└── package.json                     # "build:arkive-preview" script
```

## Work Phases

### Phase A — MVP (commit `27013bc7`)

- 4 Solidity contracts (0.8.24): PointsSystem, UserRegistry, PostRegistry, VaultRegistry
- React 18 + Vite 5 + Tailwind frontend
- Pages: Landing, Feed, Vault, Profile
- Vault v1: Lit Protocol only

### Phase B — NutriThrive Private Preview (commit `27013bc7`)

| Setting | Value |
|---------|-------|
| URL | `https://nutrithrive.com.au/private/arkive-preview/` |
| Auth | HTTP Basic Auth: `nt-preview` / `arkive-test-2026` |
| SEO | `X-Robots-Tag: noindex, nofollow` |

Integration: `vite.config.js` base + `BrowserRouter` basename = `/private/arkive-preview/`

### Phase C — Bug Fixes (commits `b3f63531`, `c47e5861`, `059d1960`)

- Lazy-load App; MetaMask fallback when no WalletConnect ID
- Netlify SPA redirects with `force = false` (fixes redirect loop)
- `setupStatus.js` + vault preflight errors for missing config

### Phase D — Survival & Recovery (local — commit before shipping)

- Dual encryption in `useVault.js` (Lit + wallet fallback)
- `DecryptModal.jsx` with explicit wallet fallback
- `/recover` page (`Recovery.jsx`)
- `deploy-to-arweave.js` for permanent Arweave deploy

**Immutable wallet derivation message (never change):**

```
ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT
```

**Arweave payload schema:** `ARKIVE_DUAL_ENCRYPTED_VAULT_FILE` v2

## Smart Contracts

Deploy order (`contracts/scripts/deploy.js`):

1. PointsSystem
2. UserRegistry
3. PostRegistry(pointsAddress)
4. VaultRegistry
5. `pointsSystem.authoriseCaller(postAddress)`

```bash
cd arkive/contracts
cp ../.env.example .env   # DEPLOYER_PRIVATE_KEY + Base Sepolia ETH
npm install
npx hardhat compile && npx hardhat test
npx hardhat run scripts/deploy.js --network baseSepolia
```

Writes `frontend/src/config/contracts.js` and copies ABIs to `frontend/src/contracts/`.

## Frontend

### Data flow — Feed

Post → Arweave TX → `PostRegistry.createPost()` → feed reads contract → fetches from `arweave.net`

### Data flow — Vault (v2)

File → AES-256-GCM → Lit encrypts key (optional) → wallet signs derivation → encrypts key → JSON to Arweave → `VaultRegistry.storeFile()`

### Local dev

```bash
cd arkive/frontend
npm install
cp ../.env.example .env
npm run dev    # http://localhost:5173
```

## Environment Variables

**`arkive/contracts/.env`**

```
DEPLOYER_PRIVATE_KEY=...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

**`arkive/frontend/.env`** (build-time — baked into bundle)

```
VITE_WALLETCONNECT_PROJECT_ID=...   # optional
VITE_ARWEAVE_KEY={"kty":"RSA",...}  # required for uploads
VITE_ARWEAVE_APP_TX=...             # after permanent Arweave deploy
VITE_ARWEAVE_RECOVERY_TX=...
```

## Deployment Workflows

### Build preview for NutriThrive

```bash
# From repo root — frontend .env must exist
npm run build:arkive-preview
git add private/arkive-preview/
git commit -m "Rebuild ARKIVE preview"
git push
```

### Permanent Arweave deploy

```bash
cd arkive/frontend
npm run deploy:arweave
# Copy TX IDs to .env, rebuild, deploy again
```

## Netlify

- `arkive/` excluded via `.netlifyignore`; only `private/arkive-preview/` ships
- SPA fallback: `force = false` on `/private/arkive-preview/*`
- Main site CI does **not** build ARKIVE automatically

## Current State Checklist

| Item | Status |
|------|--------|
| MVP code | Committed + on Netlify preview |
| Survival/recovery code | Local — commit + rebuild preview |
| Smart contracts deployed | No — addresses are zero |
| Arweave upload key | Needs `frontend/.env` |
| Permanent Arweave app deploy | Not run |
| Preview URL loads UI | Yes |
| Uploads/posts work | Needs contracts + Arweave key |

## Redo From Scratch

1. Copy `arkive/` tree
2. `cd arkive/contracts` → install, test, deploy to Base Sepolia
3. `cd arkive/frontend` → install, configure `.env`, `npm run dev`
4. Integrate preview path (`/private/arkive-preview/`) or set `VITE_BASE_PATH` for standalone
5. `npm run build:arkive-preview` from repo root
6. Apply survival system (dual encryption, Recovery page, deploy script)
7. Test on Base Sepolia (84532): register, post, vault upload/decrypt, `/recover`
8. Optional: `npm run deploy:arweave` for permanent hosting

## Critical Design Decisions

- **Base path:** Preview at `/private/arkive-preview/` — changing requires rebuild
- **Netlify SPA:** Must use `force = false` or redirect loops occur
- **Wallet fallback message:** Immutable — changing breaks existing vault files
- **v1 vs v2 vault:** Lit-only v1 files won't decrypt with v2-only code paths
- **Build-time secrets:** `VITE_ARWEAVE_KEY` is embedded in JS bundle at build time
