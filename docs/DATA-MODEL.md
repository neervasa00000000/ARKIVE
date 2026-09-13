# Data model

Current persistence: Base Sepolia UserRegistry, WalletLinker, VaultRegistry, PostRegistry and PointsSystem; browser IndexedDB ciphertext cache; public storage bundles and optional offline copies. No PostgreSQL database currently exists.

Target Capsule model (not deployed): User, Capsule, File, PreservationRecord, Guardian, Proof, Payment and AuditEvent. All private entities reference their capsule owner. APIs must derive identity from a verified session, query owner-scoped records and use transactions for state changes. File names, capsule titles/descriptions and original hashes belong in encrypted client metadata, not plaintext public proofs. Sizes/status are operational metadata with retention/access policies.

Store monetary amounts as integer minor units; provider payment IDs unique; webhook event IDs unique for idempotency. PreservationRecord is one-to-many per file. Guardian invitation tokens are random, stored hashed, expire, and do not grant content access. Never store unwrapped keys. Audit events exclude private content/keys and are append-only for the application role; database administrators can still alter data without independent tamper-evident anchoring.
