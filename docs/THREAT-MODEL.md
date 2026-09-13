# Threat model

| Threat | Impact | Mitigation | Remaining risk |
|---|---|---|---|
| Server compromise / malicious employee | New client code steals open files and keys | Minimize server privileges, strict CSP, review deployments, offline recovery | Cannot protect users from malicious app code during use |
| Database leak | Operational metadata disclosure | Encrypt sensitive metadata; owner-scoped API | Database not implemented; size/timing still leak |
| Storage compromise/corruption | Ciphertext loss or tampering | GCM authentication, trusted hash comparison, offline copy | No independent replicas; same-header hash is not authenticity proof |
| Provider disappears / blockchain disappears | Retrieval/discovery failure | Offline package with stored derivation domain | Current local cache is optional, capped; remote availability unproven |
| Lost account/device/keys | Permanent loss of access | User-held passphrase and offline encrypted copy | Email login cannot recover an encryption key; weak phrases allow guessing |
| Guardian collusion/takeover | Recovery abuse | No guardian cryptography claimed | Existing backup wallets already have full access |
| Malicious uploaded file | Preview exploit / resource exhaustion | MIME allowlist, bounded parsing/KDF, sandbox PDF, size limits | Browser decoder vulnerabilities; file validation is not antivirus |
| Wallet signature phishing | All wraps using signature become decryptable | Explain secret signature, fixed typed data purpose, trusted app | EIP-712 does not bind to web origin |
| Session theft / XSS | Plaintext theft and unauthorized actions | React escaping, strict script CSP, no raw keys in storage | Browser extensions and third-party code remain trusted |
| CSRF | Unwanted authenticated actions | Current operations need wallet signatures; restrict origins | Future cookie sessions require SameSite, secure cookies and CSRF defense |
| Payment fraud / replay | Sponsor credit drain | Dedicated key, default disabled, testnet, quotas and payload signatures | Multi-instance quotas/replay need shared durable storage |
| Supply-chain compromise | Code execution or key theft | Lockfile, advisory checks, minimal dependencies | Transitive wallet/storage/Lit dependency tree needs review |
| Metadata leakage | Addresses/activity/content types correlate users | Generic labels; encrypted filenames | Chain history, public feed and storage size remain public |
| Identity graph corruption / ID front-running | Broken ownership/index access | Reject nested links; owner-scoped object dedup | Existing immutable deployment requires replacement |
