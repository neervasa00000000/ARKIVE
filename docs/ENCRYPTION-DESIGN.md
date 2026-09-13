# Encryption design

Implemented: random 256-bit per-file AES key; independent random 96-bit GCM IVs for content, metadata and each key wrap. SHA-256 covers encrypted content. Metadata including filename is separately encrypted with the same file key and a distinct IV. PBKDF2-SHA256 derives a passphrase wrapping key with a random salt. Keys and signatures must never be logged or persisted as plaintext.

Wallet wrapping hashes the EIP-712 signature into an AES key. NOT PRODUCTION READY: this is application key management built on standard primitives, with signature secrecy/determinism assumptions, not an audited wallet encryption protocol. A phishing site can ask for the same signature. Preserve legacy decoding so fixes do not strand existing archives. Do not silently substitute the current deployment domain for invalid stored domains.

The ARKV v3 binary format contains a bounded JSON header followed by GCM ciphertext. Recovery validates format and KDF parameters before signing or expensive derivation. GCM authentication failures must fail closed. Whole-object hashes stored beside objects are not independent authenticity proofs; a trusted commitment is needed to detect wholesale substitution.

Capsule key hierarchies, passkey PRF, device keys and guardian threshold recovery are design work only. Authentication must be separate from encryption; an email password reset cannot recreate lost keys.
