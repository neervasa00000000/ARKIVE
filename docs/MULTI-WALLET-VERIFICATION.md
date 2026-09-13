# Multiple wallet connection fixes

The wallet button opens RainbowKit account/network controls. A Switch wallet disclosure lists connected connectors and offers Connect another wallet. Accounts within an individual wallet are selected in that wallet's app. EIP-6963 injected-wallet discovery is explicitly enabled. WalletConnect mobile connections require a valid configured project ID.

Storage and sponsor signing use the captured wallet client and its explicit account. Failed, rejected, or timed-out signatures do not fall back to window.ethereum, another account, or a duplicate signing prompt. Unsupported smart-account signing now fails instead of silently substituting an owner account.

Turbo client and feed preparation caches distinguish wallet client instances, including two providers exposing the same address. Visiting the feed no longer requests the preparation signature automatically. Decryption results are cleared on account/connector changes, and stale asynchronous completions are discarded.

Wallet linking reads and writes explicitly target Base Sepolia. Writes include the selected connector and account; wrong-network attempts are blocked. Identity queries use Wagmi query.enabled, and all identity/capacity queries refresh after successful transactions. Linking forms reset when the account/connector changes. Secondary wallets cannot use controls to unlink siblings, and primary wallets with dependents cannot request to join another primary identity. Copy distinguishes identity linking from decryption authorization.

Verification: 76 frontend tests pass, including Wagmi connect/switch/disconnect scenarios with different addresses and identical addresses across two connectors, and selected-client signing rejection/timeout handling. Production build passes with existing large-bundle warnings.

Not yet verified with real browser extensions or mobile wallets: simultaneous MetaMask/Rabby connections, WalletConnect sessions and QR reconnection, hardware-wallet prompts, live Turbo upload/retrieval, and smart-account compatibility. These changes are local and have not been deployed. Tests do not constitute a complete security audit.
