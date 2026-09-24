# arkive-recover

Standalone, zero-dependency Node.js recovery tool for existing ARKIVE v3 bundles using Recovery Specification v1 passphrase wraps.

It does not import the React application, contact Base, read `VaultRegistry`, access browser state, or retrieve from Arweave. A local `.arkive` file is mandatory.

```bash
node tools/arkive-recover/cli.mjs inspect research/fixtures/archives/passphrase-v1.arkive
ARKIVE_RECOVERY_PASSPHRASE='TEST ONLY - ARKIVE recovery fixture 2026' \
  node tools/arkive-recover/cli.mjs recover research/fixtures/archives/passphrase-v1.arkive \
  --output /tmp/arkive-recovered
```

For real use, prefer `--passphrase-file` so the credential is not placed in shell history. The tool never accepts a passphrase as an ordinary command-line value and never prints credentials or key material.

## Runtime dependencies

- Node.js 22 or newer
- Node built-ins: `crypto`, `fs`, and `path`
- One local archive and one valid passphrase

No npm packages are required.
