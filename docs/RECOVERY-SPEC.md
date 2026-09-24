# ARKIVE Recovery Specification v1

**Status:** Normative for seals that set `recoverySpecVersion: "1"` in the vault header. Clarified interoperability profile, 24 September 2026.
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

Magic bytes: the four literal ASCII/UTF-8 bytes `ARKV` (`0x41 0x52 0x4b 0x56`).
Bundle version: one unsigned byte with value `3`. Readers MUST reject unsupported values rather than guessing a layout.
Layout:

```
[4 magic][1 bundleVersion][4 headerLen unsigned BE][header JSON UTF-8][ciphertext || GCM tag]
```

`headerLen` is an unsigned 32-bit big-endian integer counting only the UTF-8 header bytes. Its value MUST be from 1 through 65,536 inclusive. The production v3 parser limits the complete bundle to 140 MiB and requires at least 16 bytes after the header for an AES-GCM tag. A conforming recovery tool SHOULD apply equal or stricter resource bounds and MUST reject truncation or arithmetic overflow.

The header is a JSON object serialized by ECMAScript `JSON.stringify` and encoded as UTF-8 without a byte-order mark. JSON object field order is not semantically significant; readers MUST NOT depend on it. Unknown fields MUST be ignored unless they conflict with a required field. JSON numbers used by v1 (`iterations`, sizes, timestamps, and `chainId`) MUST be finite integers in their documented ranges. Version identifiers (`recoverySpecVersion`, `schema`, `method`, and `derivationVersion`) are case-sensitive strings. Current browser readers use non-fatal Web `TextDecoder` behavior, which replaces malformed UTF-8 sequences with U+FFFD before JSON parsing. Writers MUST emit valid UTF-8; malformed input is not a conforming archive and readers MAY reject it earlier.

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
| Authentication tag | 128 bits (16 bytes) |
| Authenticated data | None; AAD is the empty byte sequence (length 0) |
| AES-GCM result bytes | Ciphertext bytes followed immediately by the 16-byte tag, `C || T` |
| Encoding of binary fields in JSON | RFC 4648 standard Base64 alphabet with `=` padding |

WebCrypto `SubtleCrypto.encrypt({ name: "AES-GCM", iv }, ...)` is used with `tagLength` and `additionalData` omitted. Under WebCrypto this means a 128-bit tag and no additional authenticated data. Every encrypted byte string in this specification (`ciphertext`, wrapped file keys, and encrypted metadata) uses the same `C || T` representation. The tag is not stored in a separate header field. Readers MUST authenticate the complete value before releasing plaintext and MUST NOT return unauthenticated bytes.

Standard Base64 means the `A-Z a-z 0-9 + /` alphabet, not Base64URL. Writers MUST emit canonical padding. Readers MAY accept an unpadded equivalent but MUST reject invalid characters or malformed lengths. Hashes are lowercase, zero-padded hexadecimal without a `0x` prefix.

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

The passphrase JavaScript string is converted directly with the Web Encoding API `TextEncoder`, producing UTF-8 bytes. Writers and readers MUST NOT trim whitespace, change case, append a terminator, or apply Unicode normalization. Consequently canonically equivalent strings such as precomposed `é` and `e` followed by U+0301 derive different keys. Non-BMP characters use their normal UTF-8 encoding. Web `TextEncoder` replaces unpaired UTF-16 surrogates with U+FFFD before UTF-8 encoding; interoperable tools SHOULD follow the Encoding Standard for such input.

Production sealing accepts a non-empty passphrase only when its ECMAScript string length is at least 8 UTF-16 code units. It preserves every accepted code unit. Recovery accepts a string of at most 1,024 UTF-16 code units; empty input is permitted by the low-level reader but cannot unlock an archive produced by the production sealing path. Passphrases are case-sensitive.

For PBKDF2, password bytes are the UTF-8 bytes above, salt is the decoded 16-byte `salt`, PRF is HMAC-SHA-256, iterations is the integer stored in the wrap, and output length is exactly 32 bytes. Production v1 writes `310000`; readers MUST reject values below `100000`, above `1000000`, non-integers, unsafe JSON integers, or salts not exactly 16 bytes. The 32-byte output is the AES-256-GCM wrapping key. The wrap IV MUST be 12 bytes and `encryptedAesKey` MUST decode to 48 bytes: 32 encrypted file-key bytes followed by a 16-byte tag.

---

## 5. Wallet cryptography

| Item | Value |
|------|--------|
| Curve | secp256k1 |
| Address | Ethereum checksummed / lowercase `0x` + 40 hex |
| Signing | EIP-712 typed data (primary) |

Compatible with Ethereum/Base wallets today. Future tools must accept a raw secp256k1 private key / BIP-39 seed — **not** a proprietary MetaMask API.

Addresses in headers are `0x` followed by exactly 40 hexadecimal characters. Production compares addresses after ASCII lowercasing and writes lowercase addresses; checksum case carries no recovery meaning. Signature hex is decoded to its raw 65 bytes, then Keccak-256 is applied to those bytes. The resulting 32 bytes are the AES-256-GCM wrapping key. It is not the SHA3-256 variant.

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

The EIP-712 type member ordering shown above is normative. Domain fields are `name`, `version`, `chainId`, and `verifyingContract`; message fields are `purpose` then `wallet`. EIP-712 encoding and signing MUST follow the Ethereum EIP-712 standard. Header JSON field order is irrelevant to EIP-712 encoding. For current v1 beta archives `chainId` is the JSON integer `84532`; `name` is the case-sensitive string `ARKIVE`; `version` is the string `2`; and `verifyingContract` is the 20-byte address represented by the stored hex string. Recovery MUST use the validated domain stored in the archive.

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

### 7.1 Encrypted metadata encoding

Current writers construct a metadata object with fields `originalContentHash`, `originalFileName`, `originalFileType`, and `originalFileSize`, serialize it with ECMAScript `JSON.stringify`, and encode that text as UTF-8 without a byte-order mark. The historical field order produced by current writers is the order just listed, but readers MUST parse JSON by field name and MUST NOT require that order.

Metadata is encrypted under `K_file` using a fresh 12-byte IV, no AAD, and the same `C || 16-byte tag` representation described in §2. `encryptedMetadata` and `encryptedMetadataIv` are canonical standard Base64 strings. After successful GCM authentication, readers decode with Web `TextDecoder` semantics and parse JSON. Current production accepts whatever JSON value `JSON.parse` returns; conforming writers MUST write an object and recovery tools SHOULD reject non-object metadata. Invalid JSON or failed GCM authentication MUST fail closed. `originalFileName` and MIME type are advisory and MUST NOT be executed or used as an unsanitized filesystem path. Writers emit `originalFileSize` as a non-negative JSON integer. Recovery tools SHOULD compare it with plaintext length. `originalContentHash`, when present, is the lowercase SHA-256 hex digest of original plaintext bytes and MUST be verified.

---

## 8. Storage pointers

Beta: primary network is **Arweave** via Turbo upload.

`archiveId` and `storageLocations` are **discovery / location metadata**. They locate candidate encrypted bytes. They are **not** cryptographic proof that retrieved bytes are the correct archive, and they MUST NOT be treated as authenticated security assertions.

Current discovery pointers are **untrusted discovery hints**. A recovery implementation MUST verify retrieved content with the archive’s existing cryptographic and integrity checks (§2, §9) before accepting recovered plaintext. Pointer-only mutation can change which remote object is fetched; it does not authenticate that object.

Discovery paths (any one may supply bytes to verify):

1. Offline `.arkive` file the user saved  
2. Arweave TX id written in Base `VaultRegistry` (if Base still exists)  
3. User-held Archive ID / Basescan history  
4. Future replicas listed in `storageLocations`

Absence of `archiveId` / `storageLocations` (legacy or unstamped archives) MUST NOT by itself cause rejection when the recoverer already holds valid archive bytes and an authorised unlock method.

---

## 9. Integrity verification

Recovery tools MUST NOT accept remotely retrieved bytes as successful recovery solely because an RID or URI pointed to them.

Recommended verification order:

1. Verify bundle magic + header length bounds  
2. When `contentHash` is present, verify it equals SHA-256 of the file ciphertext bytes — fail closed on mismatch. `contentHash` is an **unauthenticated checksum** checked during recovery; it is not a signature, MAC, or proof of ownership by itself.  
3. Unwrap `K_file`, then decrypt content with AES-256-GCM (§2). GCM authentication MUST succeed before any plaintext is released. AES-GCM authentication is separate from the `contentHash` checksum.  
4. After unwrap, decrypt `encryptedMetadata` with `K_file` to obtain filename / MIME  
5. When `originalContentHash` is present in metadata, verify it against recovered plaintext — fail closed on mismatch  
6. Confirm decrypted plaintext size matches `originalFileSize` when set  
7. Treat MIME / filename as advisory only — never execute recovered content

All SHA-256 operations hash the exact byte sequence identified by the field. `contentHash` hashes the complete encrypted file `C || T`, including its 16-byte authentication tag. `originalContentHash` hashes the recovered plaintext bytes. Hex comparison SHOULD be performed against exactly 64 lowercase hexadecimal characters; malformed values MUST be rejected rather than silently ignored.

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

The 24 September 2026 edits clarify the already-deployed v1 byte representation and validation rules. They do not alter archive semantics and therefore do not require bundle v4 or a new `recoverySpecVersion`. The fixed vectors in `research/conformance/vectors.json` are normative examples for v1 interoperability; where prose and a vector appear inconsistent, implementations MUST report the inconsistency rather than inventing a fallback.

---

## Reference implementation

| Component | Location |
|-----------|----------|
| Bundle encode/decode | `frontend/src/lib/vaultBundle.js` |
| Key wrap / unwrap | `frontend/src/lib/vaultKeyWrap.js` |
| EIP-712 derivation | `frontend/src/lib/vaultDerivation.js` |
| Seal / retrieve | `frontend/src/hooks/useVault.js` |
| Architecture overview | `docs/ARCHITECTURE.md` |
