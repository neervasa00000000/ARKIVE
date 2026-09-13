# MVP scope and reality

Existing product: wallet-based testnet vault, public feed, profile, wallet linking, points, local AES encryption, backup wallet wraps, optional passphrase recovery and offline package export.

Not implemented: email/passkey authentication, Capsule dashboard and collections, Stripe checkout, PostgreSQL/Prisma, guardian invitations, threshold recovery, cryptographic time release, redundant storage, scheduled integrity checks, durable cross-session registration recovery. No fake replacement UI will mark these complete.

Priority: fix confirmed vulnerabilities and preserve decrypt compatibility; test complete encryption/export/import/decryption; document release blockers. Then establish audited non-wallet key management, authenticated API/database, provider abstraction, Capsule UI, verified retrieval and test-mode payment webhooks. Each phase needs real tests and explicit prototype states.
