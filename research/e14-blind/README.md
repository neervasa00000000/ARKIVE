# E14 blind specification-only recovery

E14 was performed by a fresh agent with no inherited conversation context inside `/private/tmp/arkive-e14-package`. The package contained only:

- `RECOVERY-SPEC.md`
- `conformance/README.md`
- `conformance/vectors.json`
- the synthetic `passphrase-v1.arkive` fixture
- the test-only credential exposed by the conformance vector mechanism

The method record was created before the first recovery execution. The agent had explicit instructions not to access the ARKIVE repository, existing recovery implementations, prior results, GitHub, the internet, or paths outside the package.

The Java source, method record, result, and recovered artifact in this directory are copied unchanged from the isolated package. Post-run auditing confirmed that the supplied files were unchanged and that the Java source contains no network, subprocess, repository, or external-path access.

Result: **PASS**, 33 of 33 checks. Exact-byte comparison is unavailable because the original plaintext was intentionally not included in the blind package; expected length and SHA-256 both match.
