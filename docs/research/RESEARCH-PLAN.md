# ARKIVE recovery dependency research plan

## Problem

Decentralized archival products can retain hidden recovery dependencies on the originating application, blockchain registry, proprietary wallet, gateway, local state, storage provider, or undocumented cryptography. Storage durability alone does not establish recoverability.

## Research question

What external dependencies are required for successful recovery of a self-custodied decentralized archive, and which dependencies can be removed or substituted without loss of recoverability?

## Working hypothesis

Offline ARKIVE recovery should require one surviving encrypted archive, one authorized unlock method, sufficient public format and cryptographic specification, and a compatible recovery implementation. It should not fundamentally require the ARKIVE website/company, Base registry, original wallet application, or browser state. These remain scoped hypotheses except where the recorded experiments validate them.

## Metrics

- Recovery success or rejection.
- Exact-byte SHA-256 equality.
- Dependencies intentionally removed and still available.
- External endpoints contacted.
- Duration.
- Failure classification.

## Experiments

The normative matrix is `research/experiments/experiment-matrix.json`. The deterministic harness executes E01-E04 and E06-E10/E12. E05 and E11 remain NOT VALIDATED.

## Limitations

- ARKIVE is a Base Sepolia testnet prototype.
- This work makes no century-scale permanence claim.
- There is no independent security audit.
- Fixtures are synthetic and small.
- Only one production archive version and the passphrase recovery path are tested independently.
- Wallet independence is not established for wallet-only archives.
- Gateway replacement and storage-network independence are not validated.
- Process-level network interception is not an OS network namespace.
- Current recovery depends on today's AES-GCM, PBKDF2-SHA-256, SHA-256, Node runtime, and compatible file/JSON parsing.
- Application independence does not imply storage-provider independence.
