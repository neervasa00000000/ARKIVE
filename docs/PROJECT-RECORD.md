# ARKIVE Public Project Record

This chronological record preserves public product and recovery milestones without reproducing unpublished research planning.

## Initial Implementation

The initial repository commit (`8e3db9d`, 23 June 2026) established the React frontend, Solidity contracts, deployment scripts, tests, and build documentation. It was an MVP, not evidence of long-term permanence or production readiness.

## Client-Side Encryption And Recovery

ARKIVE developed browser-side AES-256-GCM encryption with random per-file keys, wallet-based key wrapping, optional passphrase recovery, backup-wallet access, and portable `.arkive` export/import. Plaintext and unwrapped file keys are intended to remain local, while the browser/frontend remains part of the trust boundary while content is open.

## Public Recovery Specification

Commit `ed84785` introduced Recovery Specification v1. Later interoperability work identified byte-level details that required clarification, including encoding, AES-GCM representation, metadata, hashes, and EIP-712 signature representation. The public specification and conformance vectors now document the tested format more precisely without claiming universal or future compatibility.

## Security Hardening

Commit `5968a53` added source-level hardening, security and threat documentation, bounded response handling, transaction checks, and broader tests. Source changes do not retroactively change deployed contracts, and the application remains a Base Sepolia testnet prototype.

## Bounded Recovery Evidence

Synthetic-fixture tests demonstrated exact local passphrase recovery without the ARKIVE frontend, backend, Base RPC, VaultRegistry, browser state, or network after archive acquisition. Wrong credentials, corruption, metadata tampering, and unsupported versions failed closed in the tested cases. Cross-language Node and Python conformance is included in the public repository.

Subsequent bounded experiments found that the historical specification needed clarification, demonstrated a blind Java recovery against the clarified materials, and recovered one synthetic EOA wallet-wrapped archive without its original wallet application. Those results do not establish gateway independence, independent storage-network substitution, universal wallet independence, cryptographic longevity, permanence, or research novelty.

## Current Public Boundary

The public repository contains the application, contracts, security and architecture documentation, Recovery Specification, standalone recovery CLI, synthetic fixture, and conformance vectors/tests. Active research planning, raw experiment coordination, and unpublished analysis are maintained separately and may be released only as deliberately frozen publication artifacts.
