# Multiple wallet connection fixes

The wallet button opens RainbowKit account/network controls. A Switch wallet disclosure lists connected connectors and offers Connect another wallet. Accounts within an individual wallet are selected in that wallet's app. EIP-6963 injected-wallet discovery is explicitly enabled. WalletConnect mobile connections require a valid configured project ID.

Storage and sponsor signing use the captured wallet client and its explicit account. Failed, rejected, or timed-out signatures do not fall back to window.ethereum, another account, or a duplicate signing prompt. Unsupported smart-account signing now fails instead of silently substituting an owner account.

Turbo client and feed preparation caches distinguish wallet client instances, including two providers exposing the same address. Visiting the feed no longer requests the preparation signature automatically. Decryption results are cleared on account/connector changes, and stale asynchronous completions are discarded.

Wallet linking reads and writes explicitly target Base Sepolia. Writes include the selected connector and account; wrong-network attempts are blocked. Identity queries use Wagmi query.enabled, and all identity/capacity queries refresh after successful transactions. Linking forms reset when the account/connector changes. Secondary wallets cannot use controls to unlink siblings, and primary wallets with dependents cannot request to join another primary identity. Copy distinguishes identity linking from decryption authorization.

Verification: 76 frontend tests pass, including Wagmi connect/switch/disconnect scenarios with different addresses and identical addresses across two connectors, and selected-client signing rejection/timeout handling. Production build passes with existing large-bundle warnings.

Not yet verified with real browser extensions or mobile wallets: simultaneous MetaMask/Rabby connections, WalletConnect sessions and QR reconnection, hardware-wallet prompts, live Turbo upload/retrieval, and smart-account compatibility. These changes are local and have not been deployed. Tests do not constitute a complete security audit.

## Small-file upload investigation

Replaced obsolete SDK development endpoint defaults (`payment.ardrive.dev`, which failed DNS here, and `upload.ardrive.dev`) with the current documented sandbox at `payment.services.ar-io.dev` and `upload.services.ar-io.dev`. Retrieval now tries `ar-io.dev`. Reference: https://docs.ar.io/build/testnet/ . Sandbox files expire after approximately three days, now stated in the upload dialog.

A live check with a throwaway wallet uploaded 7,168 synthetic bytes without payment and retrieved an exact byte match. Transaction ID: `03TGt9S8MCyJ0r_08L3TbnT1_78o-AZVg4azXRxkyiM`. This verifies the SDK/service round trip, not browser wallet prompts or vault contract registration. The script is `frontend/scripts/check-testnet-upload.mjs`.

Small bundles now attempt service-side free/existing-credit upload before pending-payment checks; allowance rejection is explicit and does not trigger an automatic new payment. Replaced misleading “Uploading…” error messages with payment-specific failures. Hosting environment overrides must use the new endpoint URLs when deploying these changes.

## Vault-specific follow-up

The vault hook still called ensureStorageCreditsReady before the shared upload function, bypassing the new small-bundle allowance path. Removed that duplicate preflight and redundant storage-link signature; shared upload funding now runs once for both feed and vault. A live synthetic encrypted vault test uploaded 7,847 bytes and downloaded/decrypted the original 7,168 bytes exactly (archive ID `jr5ZGhNxrzXBQx2MNcPHiZgm03hYTY-0dGOxiXjfC-w`). No payment was sent. Frontend tests: 76 passed; production build passed. Browser wallet signing and final on-chain registration were not exercised by this synthetic check.
