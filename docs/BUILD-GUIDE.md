# ARKIVE — Developer Build Guide

Canonical repo: [github.com/neervasa00000000/ARKIVE](https://github.com/neervasa00000000/ARKIVE)

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
ARKIVE/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── contracts/                   # Hardhat Solidity project
├── frontend/                    # React + Vite app
├── docs/                        # Documentation (this file)
└── scripts/                     # Shared deployment helpers
```

## Quick Start

### Contracts

```bash
cd contracts
cp .env.example .env          # DEPLOYER_PRIVATE_KEY + Base Sepolia ETH
npm install
npx hardhat compile && npx hardhat test
npx hardhat run scripts/deploy.js --network baseSepolia
```

Deploy writes `frontend/src/config/contracts.js` and copies ABIs to `frontend/src/contracts/`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                     # http://localhost:5173
```

## Environment Variables

**`contracts/.env`**

```
DEPLOYER_PRIVATE_KEY=...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

**`frontend/.env`** (build-time — baked into bundle)

```
VITE_WALLETCONNECT_PROJECT_ID=...   # optional
VITE_ARWEAVE_KEY={"kty":"RSA",...}  # required for uploads
VITE_ARWEAVE_APP_TX=...             # after permanent Arweave deploy
VITE_ARWEAVE_RECOVERY_TX=...
VITE_BASE_PATH=/                    # optional; use /subdir/ for subpath hosting
```

## Data Flows

### Feed

Post → Arweave TX → `PostRegistry.createPost()` → feed reads contract → fetches from `arweave.net`

### Vault (v2 dual encryption)

File → AES-256-GCM → Lit encrypts key (optional) → wallet signs derivation → encrypts key → JSON to Arweave → `VaultRegistry.storeFile()`

**Immutable wallet derivation message (never change):**

```
ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT
```

**Arweave payload schema:** `ARKIVE_DUAL_ENCRYPTED_VAULT_FILE` v2

## Deployment

### Production build

```bash
cd frontend
npm run build                   # output in frontend/dist/
```

Serve `dist/` on any static host (Netlify, Vercel, Arweave). Set `VITE_BASE_PATH` before build if hosting under a subpath.

### Permanent Arweave deploy

```bash
cd frontend
npm run deploy:arweave
# Copy TX IDs to .env, rebuild, deploy again for embedded recovery URLs
```

## Current State Checklist

| Item | Status |
|------|--------|
| MVP source | In this repo |
| Survival/recovery (dual encrypt, /recover) | Included |
| Smart contracts deployed | No — addresses are zero placeholders |
| Arweave upload key | Needs `frontend/.env` locally |
| Permanent Arweave app deploy | Not run |

## Testing Checklist

On Base Sepolia (84532):

1. Connect wallet
2. Register username on Profile
3. Create feed post
4. Upload vault file → decrypt via Lit
5. Test wallet fallback decrypt
6. Visit `/recover`

## Critical Design Decisions

- **Wallet fallback message:** Immutable — changing breaks existing vault files
- **v1 vs v2 vault:** Lit-only v1 files won't decrypt with v2-only code paths
- **Build-time secrets:** `VITE_ARWEAVE_KEY` is embedded in JS bundle at build time
- **Subpath hosting:** Set `VITE_BASE_PATH` in `.env` before `npm run build`
