# ARKIVE

> **Testnet prototype — not production-ready.** Keep original files and an independent encrypted backup. Testnet uploads are not a permanence guarantee. See [security review and feature inventory](docs/SECURITY-REVIEW.md) for verified functionality, vulnerabilities fixed, and remaining release blockers. The Capsule/Stripe/email-auth product in the new brief is a future phase.

**Your files shouldn't depend on our company existing.**

ARKIVE is a self-custodied, encrypted personal vault. Files are encrypted in your browser before they leave the device, stored on decentralized networks (Arweave today), and indexed on Base. **No single company controls your files or holds the keys needed to read them** — including ARKIVE.

## What it is

| Surface | Privacy | Storage | On-chain registry |
|---------|---------|---------|-------------------|
| **Vault** | Private — encrypted client-side; only authorised wallets can decrypt | Arweave (Turbo SDK) | `VaultRegistry` on Base |
| **Feed** | Public permanent posts | Arweave (Turbo SDK) | `PostRegistry` on Base |

Encrypted blobs live on storage networks; Base is a discovery/index layer, not the only place your archive can be found. Sensitive filenames are encrypted inside the vault header (on-chain records use a generic label).

## How the vault works

1. Connect an Ethereum wallet (Base Sepolia for the current beta)
2. Choose a file — it is encrypted in the browser with a **random AES-256-GCM key**
3. That file key is **wrapped** for your wallet (EIP-712) and optionally a **recovery passphrase** and/or **up to two backup wallets** (3 authorised wallets total)
4. The encrypted bundle is uploaded to Arweave (you pay storage via Turbo from your wallet)
5. A record is written to `VaultRegistry` on Base (index only)
6. To open a file: connect any authorised wallet, sign the vault key challenge, decrypt locally

Wrong wallet → nothing useful. The ciphertext can be public; the content stays unreadable without a wrap you can unlock.

## Tech stack (as implemented)

- **Wallet** — RainbowKit / wagmi
- **Encryption** — AES-256-GCM (Web Crypto); wallet key wrap via EIP-712; optional PBKDF2 recovery passphrase; encrypted metadata
- **Permanent storage** — Arweave via [@ardrive/turbo-sdk](https://docs.ardrive.io/) (user-paid ETH on Base)
- **Access registry** — Solidity contracts on Base (Sepolia beta)
- **Frontend** — React + Vite

> **Not implemented:** Filecoin deals, Irys SDK, or a legal “130-year guarantee.” Permanence follows Arweave’s long-term storage model. Do not claim Filecoin permanence until that path exists.

## Recovery (important)

ARKIVE does not hold a master key. If all authorised wallets (and any recovery passphrase) are permanently lost, **the archive is permanently inaccessible**. That is intentional.

When sealing you can add:

1. **Seed phrase backup** of your main wallet  
2. **Recovery passphrase** — wraps the file key (PBKDF2)  
3. **Up to two backup wallets** — each can unlock the archive if the main wallet is lost  
4. **Offline `.arkive` copy** — downloaded after seal; recoverable without this website

Long-term design goal: recovery needs an authorised key (or passphrase) + one archive copy + the public [Recovery Specification](docs/RECOVERY-SPEC.md) — not a living company or a single blockchain.

Accurate promise (vs marketing shortcuts):

- Prefer: *No single company controls your files* / *Your files shouldn't depend on our company existing*
- Avoid: *No company stores your data* (storage networks still involve operators)
- Avoid: *Stored on blockchain forever* (the chain is an index; ciphertext lives on storage networks)

## Status

Public beta on Base Sepolia.

- Live: **https://arkive-beta.vercel.app**
- Backup host: **https://arkive-beta.netlify.app**
- Code: this repository

## Repository layout

```
ARKIVE/
├── ai/                   ← optional local LoRA for labels (not required for Suggest)
├── README.md
├── DEPLOY.md             ← beta hosting
├── docs/
│   ├── ARCHITECTURE.md   ← encrypt → wrap → store → decrypt
│   ├── RECOVERY-SPEC.md  ← blockchain-independent recovery (normative)
│   ├── SECURITY.md
│   └── BUILD-GUIDE.md
├── contracts/            ← Solidity (Base Sepolia)
├── frontend/             ← React app + Turbo sponsor server
└── scripts/
```

## Development

```bash
cd frontend
cp .env.example .env   # set WalletConnect project id if needed
npm install
npm run dev            # Vite + sponsor plugin (see DEPLOY.md)
```

Contracts: see `docs/BUILD-GUIDE.md`. Security model: `docs/SECURITY.md`. Architecture: `docs/ARCHITECTURE.md`.

## Local title & tag suggestions (Ollama)

This is **not** training. The editor calls a model on your Mac. No OpenAI / Anthropic / Gemini tokens. No cloud LLM bill.

There is **no cloud-free public inference**. Each user must run Ollama locally. Hosted ARKIVE cannot see your notes and cannot substitute a cloud model.

### Click-path test (Phase 1)

```bash
ollama pull qwen2.5:7b
ollama run qwen2.5:7b "Return JSON only: {\"title\":\"t\",\"tags\":[\"a\"],\"summary\":\"s\"}"
cd frontend && npm run dev
```

1. Open the app, go to Vault → **New note**.
2. Paste a note (no secrets).
3. Click **Suggest title & tags**.
4. **Accept** (or **Edit**, then tweak) writes title, tags, and summary into the note.
5. **Encrypt & store** uses the existing vault encrypt/save path.
6. **Lock** clears suggestion plaintext from UI state.

Optional: Profile → Local suggestions — enable toggle, model name, **Check Ollama**. After a local fine-tune, the model name can be `arkive-labels`. Default stays `qwen2.5:7b`.

The app refuses any endpoint that is not `http://127.0.0.1:11434` or `http://localhost:11434`. Vault plaintext is sent only for the active note when you click Suggest.

### Phase 1 acceptance

- [x] Ollama running + model present → suggestions appear (after `ollama pull qwen2.5:7b`)
- [x] Ollama stopped / model missing → exact error `Start Ollama locally. Run: ollama pull qwen2.5:7b`, fail-fast (~400ms), no hang
- [x] Non-localhost endpoint rejected
- [x] Accept updates note fields; Encrypt & store uses the existing vault path
- [x] Lock clears suggestion plaintext from UI state
- [x] Production build succeeds
- [x] This repo does not require cloud AI keys for Suggest

### Phase 2 — collect samples before training

After Accept (or a manual correction), click **Export suggestion sample (local)**. That downloads one JSONL line. Nothing is uploaded. Real collections belong in `ai/datasets/collected/` (gitignored). Collect 20–50 corrected examples, then see [`ai/README.md`](ai/README.md).

### Phase 3 — optional LoRA (not on the Suggest click path)

Training is a separate step. See [`ai/README.md`](ai/README.md). You do not need it for v1. App default stays `qwen2.5:7b` until you switch the model name.

## Contact

Built by Neer Vasa — goosebumps0051@gmail.com
