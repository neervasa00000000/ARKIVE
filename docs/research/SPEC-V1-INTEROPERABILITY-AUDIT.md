# Recovery Specification v1 interoperability audit

This audit documents existing production behavior. It did not change production code, cryptography, archive bytes, or archive semantics.

## Source evidence

| Topic | Existing behavior | Production evidence |
| --- | --- | --- |
| Framing | `ARKV`, byte `3`, unsigned 32-bit big-endian header length, UTF-8 JSON, then encrypted bytes | `frontend/src/lib/vaultBundle.js:7-29` |
| Bounds | Header maximum 64 KiB; complete parsed bundle maximum 140 MiB; at least 16 post-header bytes | `vaultBundle.js:9-10, 47-55, 81` |
| Header JSON | ECMAScript `JSON.stringify`, `TextEncoder` UTF-8; reader uses non-fatal `TextDecoder` and `JSON.parse` | `vaultBundle.js:15, 53` |
| AES key | Random extractable 256-bit AES-GCM file key; raw export is 32 bytes | `frontend/src/lib/vaultKeyWrap.js:11-23` |
| AES-GCM | Random 12-byte IV; WebCrypto defaults; no `additionalData` or `tagLength` supplied | `vaultKeyWrap.js:26-35` |
| GCM representation | WebCrypto encryption result is retained as one byte array: ciphertext followed by default 128-bit tag | `vaultKeyWrap.js:28-29`, WebCrypto AES-GCM result semantics |
| Passphrase bytes | `new TextEncoder().encode(passphrase)`; no trim, case folding, or Unicode normalization | `vaultKeyWrap.js:37-46` |
| Passphrase limits | Seal requires at least 8 JavaScript UTF-16 code units; recovery allows strings up to 1,024 | `vaultKeyWrap.js:66-69, 98`; `frontend/src/hooks/useVault.js:150-155` |
| PBKDF2 | HMAC-SHA-256, 310,000 writer iterations, 16-byte random salt, 32-byte AES key | `vaultKeyWrap.js:9, 45-51, 70-78` |
| PBKDF2 reader bounds | Safe integer from 100,000 through 1,000,000 and exactly 16-byte salt | `vaultKeyWrap.js:92-99` |
| Base64 | Browser `btoa` writer and `atob` reader: standard alphabet; writer emits padding | `frontend/src/lib/security.js:290-308` |
| Metadata | `JSON.stringify` then UTF-8; fresh 12-byte IV; same AES-GCM representation; `JSON.parse` after decrypt | `vaultKeyWrap.js:113-130` |
| Metadata fields | Current seal insertion order: content hash, filename, MIME, size | `frontend/src/hooks/useVault.js:176-186` |
| Hashes | SHA-256 rendered as 64 lowercase hexadecimal characters without prefix | `vaultKeyWrap.js:108-111` |
| Content integrity | `contentHash` covers complete encrypted file bytes including tag; original hash covers plaintext | `useVault.js:173-179`; `frontend/src/lib/vaultCrypto.js:5-15` |
| Addresses | Exactly `0x` plus 40 hex characters, normalized to lowercase for storage/comparison | `frontend/src/lib/security.js:166-173` |
| Wallet wrapping key | Hex signature decoded to bytes, Keccak-256 over raw signature, 32-byte AES key import | `frontend/src/lib/vaultDerivation.js:45-53` |
| EIP-712 | Ordered domain/type/message definitions; stored beta domain must be ARKIVE/2/84532/valid contract | `vaultDerivation.js:16-27, 29-42, 93-109` |
| Optional/unknown fields | Decoded header is spread into a payload; unknown fields survive and field order is unused | `vaultBundle.js:57-67` |
| Version behavior | Bundle parser accepts byte 3; derivation and recovery versions are explicit and fail on unsupported values | `vaultBundle.js:32-45`; `vaultDerivation.js:82-109` |

## Clarification decision

The omissions were documentation defects, not evidence of multiple deployed formats. Recovery Specification v1 was clarified in place because all normative byte values describe archives already emitted with `recoverySpecVersion: "1"`. A new bundle version would incorrectly imply a wire-format change.

## Residual boundary

Cross-implementation conformance can validate the clarified interpretation against existing archives. Because the independent Python implementation predates this clarification, a genuinely isolated specification-only reimplementation remains a separate unperformed experiment.
