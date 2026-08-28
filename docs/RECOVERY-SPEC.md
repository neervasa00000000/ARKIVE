# ARKIVE Recovery Specification v1

**Status:** Normative for seals that set `recoverySpecVersion: "1"` in the vault header.  
**Goal:** An authorised private key + one surviving copy of the archive + this document must be enough to recover files — even if the ARKIVE company, website, and Base chain are gone.

This is a **public specification**. Future developers may implement compatible recovery tools without ARKIVE’s servers or UI.

---

## Design principle

| Layer | Role | Required for recovery? |
|-------|------|------------------------|
| **Storage** | Holds the encrypted archive bytes | **Yes** — at least one copy |
| **Identity** | Authorised wallets / passphrase wraps | **Yes** — one unlock method |
| **Chain registry (Base)** | Discovery & integrity index | **No** — convenience only |
| **ARKIVE app** | UX | **No** |

Minimum recovery set:

1. One authorised private key **or** the recovery passphrase  
2. One surviving encrypted archive copy (`.arkive` / Arweave TX / future network)  
3. This Recovery Specification (or an equivalent implementation)

---

## 1. Archive file format

### Bundle (on-wire / on-disk)

Magic bytes: `ARKV` (`0x41 0x52 0x4b 0x56`)  
Bundle version byte: `3`  
Layout:

```
[4 magic][1 bundleVersion][4 headerLen BE][header JSON UTF-8][ciphertext bytes]
```

Header `schema` field: `ARKIVE_VAULT_BUNDLE_V3`

Legacy JSON payloads (`ARKIVE_DUAL_ENCRYPTED_VAULT_FILE`) remain decryptable by older clients; new seals SHOULD use the binary bundle.

### Self-contained recovery package

Conceptually each archive is:

```
ARKIVE_ARCHIVE
├── encrypted file ciphertext
├── header / manifest (JSON)
│   ├── encryption parameters
│   ├── key wraps (wallets + optional passphrase)
│   ├── authorised wallets
│   ├── integrity / size metadata
│   └── recoverySpecVersion
└── (optional offline stamp) archiveId + storageLocations
```

Offline `.arkive` downloads MAY stamp `archiveId` and `storageLocations` after upload. On-network blobs are still recoverable: the network TX id *is* the primary locator.

---

## 2. Encryption algorithm

| Item | Value |
|------|--------|
| Content cipher | AES-256-GCM |
| File key | Random 256-bit key per seal (Web Crypto / equivalent CSPRNG) |
| IV | 12 random bytes per AES-GCM operation |
| Encoding of binary fields in JSON | Standard Base64 |

The wallet signature is **never** used as the raw file AES key.

---

## 3. Key generation

1. Generate random AES-256-GCM key `K_file`  
2. Encrypt plaintext → `C_file`, `IV_file`  
3. Wrap `K_file` for each unlock method (see §4)

---

## 4. Key wrapping

### 4.1 Wallet wrap (`method`: `eip712-v2`)

1. Wallet signs EIP-712 typed data (see §5–6)  
2. `K_wrap = keccak256(signature)` interpreted as 32-byte AES key  
3. Encrypt `K_file` with AES-256-GCM under `K_wrap` → store in `keyWraps[]`

Each wrap object:

```json
{
  "wallet": "0x…",
  "method": "eip712-v2",
  "encryptedAesKey": "<base64>",
  "iv": "<base64>"
}
```

Legacy fields `walletEncryptedAesKey` / `walletEncryptedAesKeyIv` are the owner wrap duplicated for older clients.

### 4.2 Recovery passphrase (`method`: `passphrase-v1`)

Stored as `recoveryWrap`:

| Field | Value |
|-------|--------|
| KDF | PBKDF2-HMAC-SHA-256 |
| Iterations | 310000 |
| Salt | 16 random bytes |
| Then | AES-256-GCM wrap of `K_file` |

---

## 5. Wallet cryptography

| Item | Value |
|------|--------|
| Curve | secp256k1 |
| Address | Ethereum checksummed / lowercase `0x` + 40 hex |
| Signing | EIP-712 typed data (primary) |

Compatible with Ethereum/Base wallets today. Future tools must accept a raw secp256k1 private key / BIP-39 seed — **not** a proprietary MetaMask API.

---

## 6. Signature format (EIP-712 v2)

**Domain**

| Field | Value |
|-------|--------|
| name | `ARKIVE` |
| version | `2` |
| chainId | As stored in header `eip712Domain.chainId` (beta: `84532`) |
| verifyingContract | VaultRegistry address in `eip712Domain.verifyingContract` |

**Types**

```
VaultKeyDerivation(string purpose, address wallet)
```

**Message**

```
purpose = "VAULT_KEY_DERIVATION"
wallet  = signing address
```

Recoverers MUST use the `eip712Domain` embedded in the archive header when present, so redeployed registry addresses do not brick old seals.

**Legacy v1** (decrypt only): personal_sign of UTF-8 string  
`ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT`

---

## 7. Manifest / header structure (v1)

Required / strongly recommended fields:

| Field | Purpose |
|-------|---------|
| `recoverySpecVersion` | `"1"` — this document |
| `schema` | `ARKIVE_VAULT_BUNDLE_V3` |
| `encryptedFileIv` | AES-GCM IV for content |
| `keyWraps` | Array of wallet wraps |
| `authorizedWallets` | Addresses allowed to decrypt (owner + up to 2 backups; max 3) |
| `encryptedByWallet` | Sealing wallet |
| `derivationVersion` | `eip712-v2` |
| `eip712Domain` | Domain used at seal time |
| `encryptedMetadata` / `encryptedMetadataIv` | AES-GCM ciphertext of JSON `{ originalFileName, originalFileType, originalFileSize }` under `K_file` |
| `contentHash` | SHA-256 hex of the file ciphertext bytes |
| `encryptedAt` | Unix ms timestamp |

Legacy / public placeholders (new seals):

| Field | Purpose |
|-------|---------|
| `originalFileName` | Often `"sealed-record"` — real name lives in encrypted metadata |
| `originalFileType` | Often `application/octet-stream` |
| `originalFileSize` | Ciphertext plaintext size (non-sensitive size hint) |

Optional:

| Field | Purpose |
|-------|---------|
| `recoveryWrap` | Passphrase wrap |
| `archiveId` | Arweave TX id (often stamped on offline copy) |
| `storageLocations` | Array of `{ network, uri, role }` |
| `lit*` | Optional Lit Protocol path (not required for recovery) |

Example `storageLocations` entry:

```json
{ "network": "arweave", "uri": "arweave://TXID", "role": "primary" }
```

Future networks (e.g. Filecoin) MAY be added as additional locations without changing the ciphertext.

---

## 8. Storage pointers

Beta: primary network is **Arweave** via Turbo upload.

Discovery paths (any one is enough):

1. Offline `.arkive` file the user saved  
2. Arweave TX id written in Base `VaultRegistry` (if Base still exists)  
3. User-held Archive ID / Basescan history  
4. Future replicas listed in `storageLocations`

---

## 9. Integrity verification

Recommended for recovery tools:

1. Verify bundle magic + header length bounds  
2. Verify `contentHash` (SHA-256 of ciphertext) when present — fail closed on mismatch  
3. After unwrap, decrypt `encryptedMetadata` with `K_file` to obtain filename / MIME  
4. Confirm decrypted plaintext size matches `originalFileSize` when set  
5. Treat MIME / filename as advisory only — never execute recovered content

---

## 10. Recovery procedure

### With an authorised wallet

1. Obtain archive bytes (`.arkive` or Arweave gateway `https://arweave.net/<TX>`)  
2. Parse bundle → header + ciphertext  
3. Confirm recoverySpecVersion `1` (or implement matching version)  
4. Find `keyWraps` entry for the wallet address (any of up to 3 authorised wallets)  
5. Sign EIP-712 per §6 using header `eip712Domain`  
6. `K_wrap = keccak256(signature)` → unwrap `K_file` → AES-GCM decrypt content + metadata  

### With recovery passphrase

1. Parse archive  
2. Use `recoveryWrap` with PBKDF2 parameters in the wrap  
3. Unwrap `K_file` → decrypt  

### If Base is dead

Skip the smart contract. Use Archive ID / offline copy / storage URI from the manifest. Decrypt as above.

### If MetaMask is dead

Use any tool that can EIP-712-sign with the private key / seed for the authorised address (§5–6).

---

## Chain role (non-normative for recovery)

Base smart contracts MAY index:

- Archive / Arweave id  
- Generic filename label (e.g. `sealed-record`) — not sensitive metadata  
- Owner address  

They MUST NOT be treated as the only place wraps or ciphertext live. A chain can die; recovery must still work from storage + manifest + key.

---

## Versioning

| Spec | Notes |
|------|--------|
| `1` | This document — up to 3 wallet wraps, passphrase wrap, encrypted metadata, Arweave primary |

Breaking crypto or layout changes require a new `recoverySpecVersion` and a new document.

---

## Reference implementation

| Component | Location |
|-----------|----------|
| Bundle encode/decode | `frontend/src/lib/vaultBundle.js` |
| Key wrap / unwrap | `frontend/src/lib/vaultKeyWrap.js` |
| EIP-712 derivation | `frontend/src/lib/vaultDerivation.js` |
| Seal / retrieve | `frontend/src/hooks/useVault.js` |
| Architecture overview | `docs/ARCHITECTURE.md` |
