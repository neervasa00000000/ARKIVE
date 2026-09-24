# Deterministic research fixtures

These files contain synthetic test data only. They contain no personal files, production keys, wallet seed phrases, or real recovery credentials.

The plaintext files are deterministic. The committed `.arkive` fixture was generated once with the production v3 archive implementation and intentionally random AES key, IVs, and PBKDF2 salt. Production encryption was not made deterministic.

## Test-only credential

`TEST ONLY - ARKIVE recovery fixture 2026`

This value is public and must never be reused for a real archive.

## Files

- `plaintext/recovery-test.txt`: small deterministic text sample.
- `plaintext/recovery-test.bin`: 256-byte deterministic binary sample recovered by the archive.
- `archives/passphrase-v1.arkive`: v3 bundle with Recovery Specification v1.
- `expected/hashes.json`: expected plaintext, ciphertext, and complete archive hashes.
- `metadata.json`: provenance and explicit test-only credential classification.

## Generation

From the repository root:

```bash
node research/fixtures/generate-fixtures.mjs
```

The generator refuses to overwrite the committed archive by default. `--force` rotates random cryptographic material and therefore changes ciphertext/archive hashes; use it only as an intentional fixture-version change and rerun all experiments.
