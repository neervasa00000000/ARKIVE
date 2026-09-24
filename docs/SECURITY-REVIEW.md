# ARKIVE security review and feature inventory

Date: 13 September 2026. Scope: existing wallet/testnet application and the supplied Capsule brief. **NOT PRODUCTION READY.** This engineering review is not an independent audit or a claim that the software is unhackable.

## What existed before this work

| Feature | Actual implementation |
|---|---|
| Private vault | Random AES-256-GCM per-file key; browser encryption before upload |
| Key protection | Wallet-signature-derived wrapping key; optional PBKDF2 recovery passphrase |
| Backup access | Owner plus up to two wallet wraps; any one can decrypt, not threshold recovery |
| Private metadata | Filename/MIME encrypted inside the bundle; generic label on-chain |
| Storage | Turbo uploads; Base Sepolia discovery registry; optional local ciphertext cache |
| Recovery export | Encrypted .arkive package; previously no working offline import form |
| Public feed | Text/images, on-chain post registry, likes and points |
| Identity | Wallet connection, username/profile and mutually confirmed wallet links |
| Hosting | Vite/React, Vercel/Netlify configurations and a sponsor endpoint |

## Added or corrected in the earlier testnet pass

- Matched Turbo payment and upload development environments; rejected mainnet wallet upload use.
- Configurable testnet service/RPC/retrieval endpoints and actual environment contract overrides.
- Payment destination obtained from the configured Turbo service instead of a fixed address.
- Transaction receipts checked for success before reporting confirmed writes.
- In-session vault retries reuse uploaded ciphertext and retain pending transaction hashes.
- Deployment waits for configuration receipts and separates generated addresses from overrides.

## Added or corrected in this security pass

| Change | Reason / boundary |
|---|---|
| Wallet identity invariants | Reject zero-address links, identity chains, cycles, and stale confirmation races |
| Owner-scoped vault deduplication | Another account cannot reserve a visible archive ID to block its owner |
| Offline recovery form at /recover | Open a .arkive copy with its passphrase locally without a wallet connection or gateway |
| Shared recovery cryptography | Browser retrieval and offline import use the same authentication/decryption implementation |
| Exact original preservation | Vault no longer strips JPEG metadata; encrypted original SHA-256 verifies exact restored bytes |
| Archive/KDF validation | Bound header sizes, unsigned lengths, GCM input and attacker-supplied PBKDF2 work factors |
| Domain validation | Invalid saved EIP-712 domains fail before requesting signatures; old valid domains remain recoverable |
| Safer previews | Explicit MIME allowlist prevents SVG/unknown media from becoming active blob types |
| Bounded remote reads | Enforce byte limits on chunked bodies even with missing/false Content-Length; gateway timeouts |
| Sponsor isolation | No automatic deployer-key loading; dedicated key and explicit local enablement; disabled on public hosts |
| Sponsor abuse controls | Bounded rate-limit maps, single-process replay rejection, strict base64/size limits and upstream timeout |
| Build secret gate | Check effective Vite/deployment env; reject demo mode and suspicious public secret variable names without logging values |
| Browser protection | Strict production script CSP across static/meta/Vercel/Netlify/preview; local dev host restrictions |
| Accurate product copy | Testnet/prototype labels replace permanence guarantees; missing local cache no longer prompts deletion |
| Dependency patches | Patched nested elliptic plus compatible axios, secp256k1, node-fetch and ws releases |
| Regression checks | Added negative security tests and a GitHub Actions test/build workflow (not yet executed in GitHub) |
| Architecture documentation | Security model, encryption design, data model, storage design, MVP scope and threat model |

## Verification evidence

- **84 product frontend tests passed in the 2026-09-24 research baseline**: encryption, wrong keys/passphrases, corrupted ciphertext, tampered hash with invalid GCM tag, disk export/reload, KDF/header bounds, safe MIME types, bounded streams, sponsor isolation, wallet signing adapter, saved-domain recovery, receipt status and build-env gates. CI output is authoritative if this historical baseline count becomes stale.
- **24 Hardhat tests pass**: identity linking and stale-state attacks, registry ownership/deletion, duplicate registration isolation, points/profile/configuration behavior.
- Production build passes. Large Web3/Lit/Turbo chunks remain a performance warning.
- Browser production preview: recovery page rendered with named controls; a synthetic .arkive backup authenticated and offered the original file for download; a wrong passphrase displayed an error and no download. No browser errors were reported on the recovery page.
- Sponsor server and Vercel/Netlify wrappers pass JavaScript syntax checks.
- No dedicated TypeScript/lint configuration existed; this pass does not claim those checks ran.
- Earlier read-only RPC check found bytecode at the configured VaultRegistry address. No new deployment, configuration lock, paid upload or production publication was performed.

## Dependency findings

`npm audit --omit=dev` before patches: **82 reported affected packages (3 critical, 22 high, 36 moderate, 21 low)**.

After compatible patches: **75 reported affected packages (0 critical, 6 high, 33 moderate, 36 low)**. Counts include transitive/meta advisories and are not a count of proven exploitable application paths.

Remaining high reports: `bigint-buffer` and its Solana/Turbo dependency chain, `undici`, and a nested `ws` dependency. Some proposed fixes require major dependency changes or upstream replacement. They remain release blockers pending reachability analysis and tested migration; the absence of critical advisories is not a safety guarantee. Do not run a blind `npm audit fix --force` on the cryptographic/recovery stack.

## Still blocked or incomplete

1. **Live contract fixes:** WalletLinker and VaultRegistry source changes require replacement deployment and a deliberate migration/read-compatibility plan. Current immutable testnet contracts retain old behavior. Existing archives must continue using their saved key domain.
2. **Live storage:** the documented `payment.ardrive.dev` hostname failed DNS resolution, including outside the sandbox. No fresh wallet-to-storage-to-new-browser retrieval was demonstrated. Configure a reachable matching testnet pair and retrieval gateway; do not substitute mainnet payments.
3. **Wallet crypto:** signature-derived wrapping remains unaudited and susceptible to same-challenge phishing. A malicious frontend or browser extension can steal plaintext/key material during use. EIP-712 does not bind the signature to a website origin.
4. **Durability:** retry registration survives only while the modal retains the same File object. Refresh/close recovery of pending registration remains unfinished. Local ciphertext cache (IndexedDB) is convenience, not archival custody, and is capped at 12 MiB; an offline export is only useful if the user actually saves it. Browser exit/`beforeunload` warnings are UX protection only and do not guarantee recovery-artifact preservation.
5. **Preservation / discovery pointers:** `archiveId` and `storageLocations` are untrusted discovery hints, not authenticated assertions. Retrieved remote bytes must pass existing AES-GCM authentication and recovery integrity checks before acceptance; `contentHash` is an unauthenticated checksum, not a signature. No independently verified replicas, scheduled remote checks, trusted public object-hash anchoring or permanent-storage guarantee on testnet.
6. **Sponsor:** public sponsorship is intentionally unavailable until shared durable replay/quotas and a bounded spending policy exist. Local replay/quotas are a prototype, not Sybil protection.
7. **Credential history:** obvious public secret names are blocked at build; this is not a full git-history credential scan or a guarantee that existing keys were never exposed. Keys were not printed or rotated.

## The supplied Capsule brief: additional features still planned

These are **not** represented as implemented: email magic-link/passkey/Google authentication; Capsule creation/dashboard/gallery; PostgreSQL and Prisma schema/migrations; Stripe test-mode checkout and verified webhooks; guardian invitation/acceptance; threshold recovery; time capsules; multi-provider adapter interface and S3/local adapters; replication; scheduled integrity jobs; proof pages; immutable-style application audit logs.

The current backup-wallet feature is full decryption access, unlike the proposed guardians. Keep these concepts separate. Database design documents were added, not a deployed database or fake schema-backed workflow. Expand in the brief's phase order after security and recoverability blockers are closed.

## Reference guidance

- [EIP-712](https://eips.ethereum.org/EIPS/eip-712): typed data does not itself provide replay protection.
- [OWASP CSP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html): avoid permissive script execution directives.
- [Turbo SDK testnet configuration](https://github.com/ardriveapp/turbo-sdk): use matching development payment/upload endpoints and testnet RPC.
