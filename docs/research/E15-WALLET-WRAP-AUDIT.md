# E15 Wallet-Wrap Audit

Status: current production behavior audited before E15 execution.

## Current EIP-712 Behavior

- Domain: `name`, `version`, `chainId`, `verifyingContract`.
- Domain values: `name = "ARKIVE"`, `version = "2"`, `chainId = 84532`, `verifyingContract = VaultRegistry address from `frontend/src/config/deployedContracts.js` unless overridden at runtime.
- Primary type: `VaultKeyDerivation`.
- Message type: `VaultKeyDerivation(string purpose, address wallet)`.
- Member ordering: `purpose` then `wallet`.
- Message values: `purpose = "VAULT_KEY_DERIVATION"`, `wallet = signing address`.
- Address normalization: production writes and compares wallet addresses after lowercase normalization with `0x` plus 40 hex characters.
- Chain ID: Base Sepolia, `84532`.
- Verifying contract: `0xe3ee4509f8da48f33E43EaC9d8F7bb05E8024589` in the checked-in deployment config.

## Signature Representation

- Signature representation: wallet/client returns a 65-byte Ethereum signature encoded as `0x` hex.
- `r/s/v` format: `r || s || v`.
- `v` convention: production hashes the raw bytes returned by the wallet/client. It does not normalize `v` before deriving `K_wrap`.
- Low-s assumptions: production does not enforce or document low-s at the wrap layer; it depends on the signing implementation.
- Hex case: production passes the signature string through `viem` `toBytes` before hashing, so hex letter case is not expected to affect bytes.
- `0x` prefix: production expects a hex value compatible with `viem` `toBytes`.
- Leading zero handling: leading zero bytes inside `r` or `s` are significant because the hash input is the decoded 65-byte signature.

## Key Derivation And Encryption

- Keccak-256 use: `keccak256(rawSignatureBytes)`, not NIST SHA3-256.
- Exact signature to `K_wrap` derivation: decode signature hex to raw bytes, Keccak-256 those bytes, import the 32-byte digest as an AES-256-GCM key.
- AES-GCM parameters: AES-256-GCM with a 12-byte IV, 128-bit tag, no AAD, output stored as ciphertext followed by tag.
- Wallet-wrap IV representation: standard Base64 in the wrap `iv` field.
- File-key representation: raw 32-byte AES key wrapped as AES-GCM ciphertext plus tag in standard Base64 `encryptedAesKey`.
- Derivation version: `eip712-v2`.

## Archive/Header Behavior

- Archive version: binary bundle v3, magic `ARKV`, one-byte version `3`, four-byte big-endian header length, UTF-8 JSON header, then encrypted file bytes.
- Header schema: `ARKIVE_VAULT_BUNDLE_V3`.
- Content hash: SHA-256 of encrypted file bytes (`ciphertext || tag`).
- Encrypted metadata: JSON string under the file key with a separate AES-GCM IV.

## Undocumented Assumptions

- Recovery depends on reproducing the exact wallet signature bytes used at seal time because `K_wrap` is derived from `keccak256(signature)`.
- ECDSA allows multiple valid signatures for the same EIP-712 digest, so equivalent signing authority alone may not reproduce the original `K_wrap` unless the signing algorithm is deterministic and representation-compatible.
- Production does not store the original signature or EIP-712 digest in the archive.
- Production does not define a signature normalization step before `K_wrap` derivation.

SPECIFICATION_AMBIGUITY_DETECTED
