# ARKIVE Documentation Index

This index identifies current public documentation and separates it from dated evidence and active research. A document's historical statements should not be silently rewritten to match later results.

## Start here

| Document | Purpose | Status |
| --- | --- | --- |
| [`../README.md`](../README.md) | Public project overview, implemented feature summary, recovery warning, and development entry point | CURRENT |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Contribution expectations | CURRENT |
| [`../DEPLOY.md`](../DEPLOY.md) | Beta deployment and production-secret handling | CURRENT operational guide |
| [`BUILD-GUIDE.md`](BUILD-GUIDE.md) | Local build, environment, data-flow, and test guide | CURRENT; overlaps deployment setup with `DEPLOY.md` |

## Product architecture

| Document | Purpose | Status |
| --- | --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System-level components, seal/retrieve flows, network roles, and promise boundaries | CURRENT |
| [`DATA-MODEL.md`](DATA-MODEL.md) | Product records and data relationships | CURRENT |
| [`ENCRYPTION-DESIGN.md`](ENCRYPTION-DESIGN.md) | Implemented client-side encryption design | CURRENT |
| [`STORAGE-ARCHITECTURE.md`](STORAGE-ARCHITECTURE.md) | Storage adapters, replicas, and integrity boundaries | CURRENT |
| [`MVP-SCOPE.md`](MVP-SCOPE.md) | Implemented prototype scope versus planned features | CURRENT snapshot; date when updated |

## Recovery and security

| Document | Purpose | Status |
| --- | --- | --- |
| [`RECOVERY-SPEC.md`](RECOVERY-SPEC.md) | Normative public specification for compatible ARKIVE recovery | CURRENT / PUBLICATION EVIDENCE; semantic changes require explicit review |
| [`SECURITY.md`](SECURITY.md) | Public security guidance and operating cautions | CURRENT |
| [`SECURITY-MODEL.md`](SECURITY-MODEL.md) | Security assumptions, protected assets, and trust boundaries | CURRENT |
| [`THREAT-MODEL.md`](THREAT-MODEL.md) | Threats, mitigations, and residual risks | CURRENT |
| [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md) | Dated source-level review, test evidence, and release blockers | CURRENT review snapshot; test counts may age |

## Operational and historical evidence

| Document | Purpose | Status |
| --- | --- | --- |
| [`TESTNET-STATUS.md`](TESTNET-STATUS.md) | Dated testnet validation results | HISTORICAL / PUBLICATION EVIDENCE |
| [`MULTI-WALLET-VERIFICATION.md`](MULTI-WALLET-VERIFICATION.md) | Investigation and verification record for multi-wallet behavior | HISTORICAL / PUBLICATION EVIDENCE |
| [`PERFORMANCE.md`](PERFORMANCE.md) | Frontend performance baseline | CURRENT baseline; becomes HISTORICAL after a newer measurement |
| [`PROJECT-RECORD-PUBLIC-PROPOSED.md`](PROJECT-RECORD-PUBLIC-PROPOSED.md) | Proposed public-safe product and recovery chronology | REVIEW CANDIDATE |

## Research boundary

The public repository retains the Recovery Specification, standalone recovery tooling, synthetic passphrase fixture, and cross-language conformance vectors needed for public interoperability. [`research/published/`](research/published/) is reserved for deliberately curated, bounded reproducibility packages.

Active plans, preregistration, raw experiment coordination, incomplete literature work, and unpublished RDS interpretation are maintained separately from the public product tree. Earlier research remains part of historical Git commits; removing it from current HEAD does not rewrite that chronology.

The repository organization audit at [`../REPOSITORY_ORGANIZATION_AUDIT.md`](../REPOSITORY_ORGANIZATION_AUDIT.md) records the classification and preservation rationale. Research evidence must not be destroyed merely because it is not publication-ready.
