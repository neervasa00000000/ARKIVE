# ARKIVE Recovery Specification v1 conformance vectors

**TEST DATA ONLY — NEVER USE THESE VALUES IN PRODUCTION.**

`vectors.json` fixes the byte-level interpretation of the existing committed synthetic archive. It includes archive framing, UTF-8 and Unicode passphrase cases, PBKDF2 outputs, file-key unwrap values, AES-GCM ciphertext/tag representation, metadata plaintext, plaintext recovery, hashes, and negative mutations.

The vectors document existing production behavior. They do not define a new archive version and do not change the fixture.

Run both conformance implementations and generate E13 evidence:

```bash
node research/conformance/run-all.mjs
```

`run-node.mjs` uses Node WebCrypto and invokes the existing Node recovery CLI as a black box. `run-python.py` exercises the independent Python implementation and Python cryptographic primitives. Both must match every deterministic vector and reject the three invalid archives.

The composed `é` case and decomposed `e` + U+0301 case intentionally produce different UTF-8 bytes and PBKDF2 keys. Leading and trailing spaces are also significant.
