# ARKIVE Security Model

## Threat model

ARKIVE protects **permanent, wallet-owned encrypted files**. Ciphertext lives on Arweave (and optionally offline `.arkive` copies). Base is an index — not the sole recovery dependency. See `docs/RECOVERY-SPEC.md`.

1. **Encryption bypass** — decrypt files without the owner wallet
2. **Upload key theft** — mitigated: runtime uploads use user-wallet Turbo (no master key in bundle). Deploy key is Node-only (`ARWEAVE_DEPLOY_KEY`).
3. **On-chain griefing** — spam registrations, posts, vault entries
4. **Client-side XSS** — malicious post content or filenames
5. **Social engineering** — trick users into signing wrong messages or connecting wrong wallet

## Security layers (implemented)

### Vault encryption

| Layer | Protection |
|-------|------------|
| AES-256-GCM | Random per-file key encrypts content before it leaves the browser |
| Wallet key wrap | File key wrapped with EIP-712-derived AES key (not raw signature-as-key) |
| Multi-wallet wraps | Up to 3 authorised wallets (owner + 2 backups) via `keyWraps[]` — 1-of-N unlock |
| Encrypted metadata | Filename / MIME sealed under the file AES key; on-chain uses a generic label |
| Recovery passphrase | Optional PBKDF2 wrap (`recoveryWrap`) for seed-loss scenarios |
| Lit Protocol | Optional path when present in payload; wallet wrap is the reliable fallback |
| Owner / authorised check | Payload must list connected wallet as owner or authorised wrap |
| Arweave ID validation | Strict 43-char format before any fetch |

**Wallet wrap (v2):** EIP-712 typed data — domain `ARKIVE` v2, `chainId` 84532, `verifyingContract` = VaultRegistry. Legacy v1 payloads use the fixed personal_sign string below.

```
ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT
```
(legacy decrypt only)

### Smart contracts

| Control | Detail |
|---------|--------|
| Username rules | Lowercase `a-z`, `0-9`, `_`, `-` only; 3–32 chars; unique |
| String limits | Max lengths on all user-supplied on-chain strings |
| Vault file types | Enum: `image`, `document`, `video`, `other` |
| Per-user vault cap | 500 records per wallet |
| Points reentrancy | `nonReentrant` on award/spend/welcome |
| Caller revocation | `revokeCaller()` on PointsSystem |
| Daily caps | Posts (20/day), points earn (500/day) |

### Frontend

| Control | Detail |
|---------|--------|
| File blocklist | No executables, HTML, SVG, scripts in vault |
| Size limits | Vault 100 MB, post images 10 MB, text 2000 chars |
| Filename sanitization | Strips path traversal on download |
| MIME allowlist | Safe blob types on decrypt preview |
| PDF sandbox | `sandbox=""` on iframe previews |
| Demo mode guard | Errors in production if demo mode left on |
| Network guard | Base Sepolia (84532) required for chain txs |

## Known limitations (plan before public launch)

### Critical (addressed / remaining)

1. **~~`VITE_ARWEAVE_KEY` in client bundle~~** — **Fixed (P0).** Browser uploads use `InjectedEthereumSigner` / ArConnect via Turbo; user pays from their wallet. Permaweb deploy uses `ARWEAVE_DEPLOY_KEY` in Node only (never `VITE_`).

2. **Metadata on-chain is public**  
   Filenames and Arweave TX IDs are visible on Basescan. Content remains encrypted.

3. **Contracts unaudited**  
   Required before mainnet with real value.

4. **Wallet loss without recovery options**  
   Seals without backup wallets or a recovery passphrase depend entirely on the owner seed phrase. UI offers up to two backups + passphrase at seal time.

5. **Storage claims**  
   Permanence is Arweave/Turbo — not Filecoin. Do not claim multi-network redundancy until implemented.

### High

4. **Lit DatilDev network** — move to production Lit network before mainnet.  
5. **Wallet signature determinism** — wallet fallback assumes consistent `personal_sign` output per wallet/message.  
6. **No upload proxy rate limiting** — until proxy exists.

## Production checklist

```bash
# contracts
cd contracts && cp .env.example .env
npx hardhat test
npx hardhat run scripts/deploy.js --network baseSepolia

# frontend
cd frontend && cp .env.example .env
# Set VITE_DEMO_MODE=false
# Set VITE_WALLETCONNECT_PROJECT_ID
# For permaweb deploy only: ARWEAVE_DEPLOY_KEY in .env (not VITE_)
npm run test:security
npm run build
```

## Reporting vulnerabilities

Email: goosebumps0051@gmail.com  
Do not open public GitHub issues for undisclosed security bugs.
