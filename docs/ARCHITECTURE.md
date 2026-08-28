# ARKIVE architecture

This document describes what the code does today — not a future roadmap.

## High-level

```
┌─────────────┐     encrypt + wrap      ┌─────────────┐     storeFile()     ┌──────────────┐
│   Browser   │ ───────────────────────► │   Arweave   │ ◄───────────────── │ Base Sepolia │
│  (React)    │     Turbo upload         │  (ciphertext)│   arweaveId + meta │ VaultRegistry│
└─────────────┘                          └─────────────┘                    └──────────────┘
       ▲                                        │
       │         fetch blob + wallet sign       │
       └────────────────────────────────────────┘
                    decrypt locally
```

**Feed** follows the same storage path without client-side encryption: public bytes → Arweave → `PostRegistry.createPost`.

## Vault seal (encrypt path)

```
Generate random 256-bit AES-GCM file key
        ↓
Encrypt file bytes with AES-256-GCM (random IV)
        ↓
Wrap file key for each authorised unlock method:
  • Owner wallet — EIP-712 VaultKeyDerivation → keccak256(sig) → AES wrap
  • Optional backup wallets (up to 2) — same EIP-712 wrap (each backup must sign once at seal)
  • Sensitive metadata (filename / MIME) encrypted under the file key
  • contentHash = SHA-256 of ciphertext
  • Optional recovery passphrase — PBKDF2 (310k iterations) → AES wrap
        ↓
Pack header JSON + ciphertext (vault bundle v3)
        ↓
Upload bundle to Arweave via Turbo (user wallet pays)
        ↓
VaultRegistry.storeFile(arweaveId, name, type, conditionsHash)
```

Legacy payloads may still expose single fields `walletEncryptedAesKey` / `walletEncryptedAesKeyIv`. New seals also write a `keyWraps[]` array (and optional `recoveryWrap`) so multiple unlock paths coexist.

## Vault retrieve (decrypt path)

```
Load vault bundle (local cache or Arweave gateway)
        ↓
Ownership check — connected address must be owner or listed in keyWraps / authorizedWallets
        ↓
Prefer Lit decrypt if payload still carries Lit ciphertext (optional path)
        ↓
Else wallet path:
  find key wrap for connected address
  → EIP-712 sign for that wallet
  → unwrap file key
  → AES-GCM decrypt file
        ↓
Or passphrase path (when UI supplies passphrase):
  unwrap recoveryWrap → decrypt file
        ↓
Preview / download in browser (MIME sandboxing applied)
```

## What is NOT the encryption key

The wallet signature is **not** used as the raw file AES key.  
The file key is random. The signature only derives a **wrapping** key for that random key.

## Networks (beta)

| Layer | Network |
|-------|---------|
| Chain registry | Base Sepolia (`84532`) |
| Storage payment | Base Sepolia ETH → Turbo (`base-eth`) |
| Blob availability | Arweave (via Turbo upload service) |

Mainnet Base + production Lit are planned; contracts and derivation domains are currently Sepolia-bound.

## If ARKIVE the company disappears

Survivors (minimum recovery set — see `docs/RECOVERY-SPEC.md`):

1. Encrypted archive bytes (Arweave TX, offline `.arkive`, or future replicas)
2. One authorised private key **or** recovery passphrase
3. Public Recovery Specification v1 (algorithms, EIP-712 domain, wrap formats)

Base / VaultRegistry is a **discovery and verification** layer. It is not required if the user still has an Archive ID or offline package.

```
Authorised key + archive copy + Recovery Spec
        → decrypt locally
```

### Layers

| Layer | Today | Long-term |
|-------|--------|-----------|
| Storage | Arweave (Turbo) | Multiple networks + offline copies |
| Identity | Wallet wraps (+ optional passphrase / backup wallet) | Same, documented in Recovery Spec |
| Registry | Base Sepolia contracts | Optional index — never sole source of truth |

### Promise language

Prefer: *designed so no single company, server, or chain must survive for recovery to remain possible.*  
Avoid: *stored on blockchain forever* as the sole guarantee.

## Feed sponsor (beta ops)

When user-paid Turbo fails (e.g. smart-account ETH misroute), the frontend may fall back to a **deployer-sponsored** upload API (`/api/turbo/sponsor-feed`). That path:

- Pays storage from a server key (never in the browser bundle)
- Still requires wallet signature over a payload-bound auth message
- Validates content-type + magic bytes server-side
- Does **not** change vault encryption (vault remains user-paid and client-encrypted)

See `DEPLOY.md` for hosting the sponsor process.
