# Independent recovery experiment

This Python implementation was written from `docs/RECOVERY-SPEC.md`, the documented binary layout, standard Python/cryptography APIs, and the committed synthetic fixture. It does not import or call ARKIVE frontend cryptography, recovery helpers, or `tools/arkive-recover`.

The comparison runner invokes the existing CLI only as black-box implementation A after implementation B has produced its output. The implementations share no recovery code.

```bash
python3 research/independent-recovery/test_runner.py
```

Runtime dependencies are Python 3.11+ and `cryptography==47.0.0`. The fixture credential is public synthetic test data.

## Historical specification ambiguities

When this implementation was authored, `RECOVERY-SPEC.md` did not explicitly state passphrase string encoding/normalization, AES-GCM tag length and serialization, AAD presence/encoding, or metadata JSON text encoding. The implementation tested the conventional interpretation: UTF-8 without normalization, a 16-byte tag appended to ciphertext, no AAD, and UTF-8 metadata JSON. No ARKIVE recovery source was consulted to resolve those points.

That historical experiment remains `NOT VALIDATED` for specification sufficiency. The specification was subsequently clarified without changing the format; current conformance is tracked separately as E13 so this pre-existing implementation is not misrepresented as a fresh specification-only reimplementation.
