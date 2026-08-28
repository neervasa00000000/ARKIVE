# ARKIVE

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

## Contact

Built by Neer Vasa — goosebumps0051@gmail.com
