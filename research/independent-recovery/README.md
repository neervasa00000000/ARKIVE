# Independent recovery implementation

This Python implementation recovers `ARKIVE_VAULT_BUNDLE_V3` passphrase-wrapped
archives from the public recovery specification. It does not import frontend
cryptography or ARKIVE application helpers.

```bash
python3 research/independent-recovery/recover.py archive.arkive \
  --output recovered --passphrase-file passphrase.txt --json
```

Runtime dependencies are Python 3.11+ and `cryptography==47.0.0`.
