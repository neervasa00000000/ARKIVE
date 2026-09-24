# ARKIVE research baseline

Observed 24 September 2026 before research tooling changes. Commit: `aaa7b413fdc4fb373c03b835d4620f461e6d5a59` with unrelated local planning files and screenshots untracked.

## Product verification

- Frontend product suite: 84 tests passed, 0 failed.
- Contracts: 24 tests passed, 0 failed.
- Production frontend build with `VITE_DEMO_MODE=false`: passed.
- Vercel and Netlify production roots: HTTP 200 with expected security headers.
- GitHub checks for the baseline commit: frontend and contracts passed.

## Archive and recovery implementation

- Binary magic: `ARKV`.
- Current bundle version: 3.
- Current schema: `ARKIVE_VAULT_BUNDLE_V3`.
- Current Recovery Specification version: 1.
- Header limit: 64 KiB; bundle limit: 140 MiB.
- File encryption: random AES-256-GCM key and random 12-byte IV.
- Passphrase wrap: PBKDF2-HMAC-SHA-256, random 16-byte salt, 310,000 iterations, AES-256-GCM.
- Wallet wrap: EIP-712-derived key, `eip712-v2`.
- Metadata: AES-256-GCM encrypted filename, MIME type, size, and original plaintext SHA-256.
- Integrity: stored ciphertext SHA-256 checked before decryption; GCM authentication; original plaintext SHA-256 checked after decryption.
- Offline package: the same v3 bundle with Recovery Specification fields; local passphrase recovery requires no RPC or registry lookup.
- Backwards compatibility: legacy JSON/single-wallet fields remain supported by the product. The new standalone research CLI intentionally targets normative v3/spec-v1 bundles first.

Production cryptographic source files were audited for this baseline and were not modified by the research framework.

## Existing recovery evidence

The product suite already tested exact-byte disk export/reload, wrong passphrases, corrupted ciphertext, GCM tampering, malicious PBKDF2 parameters, malformed headers, unsupported versions, wallet wraps, backup wallets, and non-secret recovery evidence.

## Excluded smoke tests found

- `fetch-vault-arweave.mjs` depended on a deleted `pinkpace.png` registry record and an unavailable legacy transaction.
- `sponsor-live.test.mjs` expected the obsolete `DEPLOYER_PRIVATE_KEY` model and an already-running local server.
- Neither test was part of normal `npm test`.

These were environmental/live smoke checks, not deterministic product tests. The research work separates those categories explicitly.
