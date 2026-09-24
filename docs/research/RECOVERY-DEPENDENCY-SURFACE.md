# Recovery Dependency Surface

Recovery Dependency Surface (RDS) is a working research concept, not a novelty or publication claim. It models which dependencies are mandatory, replaceable, discovery-only, or product conveniences for a defined recovery path.

## Scope of current evidence

The validated path is offline passphrase recovery from an already-available local ARKIVE v3 archive using Recovery Specification v1. Results must not be generalized to wallet recovery, network discovery, gateway failover, or storage-provider failure without separate experiments.

## States

- **OBSERVED:** present in code or specification, without a controlled removal experiment.
- **HYPOTHESIZED:** expected classification, not experimentally established.
- **EXPERIMENTALLY VALIDATED:** supported by a recorded controlled run.
- **NOT VALIDATED:** required infrastructure or experiment does not yet exist.

## Current dependency graph

```text
exact plaintext recovery
├── local encrypted archive bytes                 REQUIRED; validated
├── valid passphrase credential                   REQUIRED; validated
├── compatible crypto/format implementation       REQUIRED, implementation replaceable; validated
└── public format/crypto knowledge                OBSERVED requirement for independent implementation

not required for the validated local passphrase path
├── ARKIVE React frontend                          validated by E02
├── ARKIVE backend/API                             validated by E03
├── Base RPC and VaultRegistry                     validated by E04
├── wallet application                             validated by E06, passphrase path only
└── browser localStorage/IndexedDB/cache/session   validated by E07

retrieval dependencies
├── original Arweave gateway                       hypothesized replaceable; E05 not validated
└── primary storage provider/network               E11 not validated
```

The machine-readable model is `research/recovery-dependencies.json`. Experiment evidence is written under `research/results/`.

## Important boundary

E03/E04 demonstrate that an archive already present on local disk can be decrypted while network access is blocked. They do not demonstrate that a user can discover or retrieve an unknown archive without Base or Arweave.

E06 demonstrates independence from wallet software only for an archive containing a valid passphrase wrap. Wallet-only archives retain wallet/signing dependencies.

The network-denial preload blocks Node `fetch`, HTTP(S), TCP, and TLS APIs in the isolated recovery process and records attempted endpoints. This is strong process-level evidence, but not an operating-system network namespace.
