# Security model

Status: testnet prototype; NOT PRODUCTION READY. This is an engineering review, not an independent audit.

Private file plaintext and random AES-256-GCM file keys stay in the browser. Remote storage receives encrypted content, encrypted metadata and wrapped file keys. There is no server master decryption key. Wallet signatures used for key derivation are secrets: anyone obtaining the exact signature can derive the wrapping key. EIP-712 is not origin-bound encryption or an anti-phishing guarantee. A compromised frontend can steal plaintext while it is open. Wallet signature determinism and long-term wallet compatibility remain assumptions.

Backup wallets are full-access 1-of-N recipients, not guardians or threshold recovery. Linking wallet identities on-chain does not create a cryptographic key wrap. Removing a link cannot revoke an already shared file key or downloaded copy.

Contract records, addresses, file types, timing and encrypted object sizes are public. Solidity private fields and eth_call access checks do not conceal chain state. Read access to ciphertext is expected; AES-GCM provides confidentiality and authentication. Testnet storage is not a permanent archive.

Public launch blockers: independent cryptographic and contract review; stable storage and retrieval; durable upload recovery; supply-chain remediation; production credential isolation; distributed sponsor quotas if enabled. Email sessions, Stripe and PostgreSQL authorization do not exist yet.
