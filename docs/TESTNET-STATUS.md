# Testnet validation — 2026-09-13

The beta pins wallet writes and receipt checks to Base Sepolia (84532).
Turbo payment and upload now use development endpoints together. Production
sponsorship is excluded from the feed path so test uploads do not require real funds.
The payment destination is fetched from the configured service's /info response.

The official payment.ardrive.dev hostname failed DNS resolution during validation,
including outside the sandbox. Set VITE_TURBO_PAYMENT_URL and
VITE_TURBO_UPLOAD_URL to a reachable matching testnet pair, plus
VITE_STORAGE_GATEWAY_URL for retrieval when using a custom storage testnet.
Do not substitute production payments for testnet payments.
Testnet uploads must not be treated as a permanence guarantee.

Contract overrides in frontend/.env.example now take effect. Deployment waits for
configuration receipts before locking configuration and writes defaults separately
from environment overrides. Existing deployed contracts were not modified.

Vault retries retain uploaded ciphertext and submitted transaction hashes while
the upload modal remains mounted and the same File is selected. Closing the modal
or refreshing loses this retry state; cross-session registration recovery remains
unfinished. Local caching is best effort and capped at 12 MiB.

Verification: frontend build, offline frontend tests, and Hardhat tests.
The configured VaultRegistry address returns deployed bytecode on Base Sepolia.
Not verified: live contract configuration, wallet-driven upload, external
gateway retrieval, and live testnet deployment. These require working infrastructure
and a connected test wallet. Existing sponsor-server edits were preserved.

## Follow-up security pass

See SECURITY-REVIEW.md for the authoritative results and feature inventory. WalletLinker and VaultRegistry now have source-level security fixes that are not deployed. Offline passphrase import is implemented. Public sponsorship is disabled. Current dependencies still have high advisories.
