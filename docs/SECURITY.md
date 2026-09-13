# ARKIVE Security

The current, authoritative review is [SECURITY-REVIEW.md](SECURITY-REVIEW.md).

- [Security model](SECURITY-MODEL.md): trust boundaries and release blockers.
- [Encryption design](ENCRYPTION-DESIGN.md): wallet-signature assumptions and recovery compatibility.
- [Threat model](THREAT-MODEL.md): attacks, mitigations and residual risks.
- [Recovery format](RECOVERY-SPEC.md): offline archive format.

This application is a testnet prototype, NOT PRODUCTION READY. Source-level fixes do not upgrade existing deployed contracts. All blockchain metadata is public regardless of Solidity visibility. Backup wallet wraps grant full access; they are not recovery guardians. A wallet signature used for wrapping must be treated as a decryption secret.

Report vulnerabilities privately to goosebumps0051@gmail.com; do not publish undisclosed exploit details in public issues.
