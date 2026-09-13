# Storage architecture

Current adapter is Turbo testnet plus gateway retrieval and best-effort IndexedDB ciphertext cache. The payment/upload environment must match. Fail closed on unavailable test infrastructure instead of charging mainnet funds. A local cache is not proof of remote preservation.

Target interface: upload(objectKey, encryptedData), download(objectId), verify(objectId, expectedHash), getStatus(), estimateCost(bytes). Each receipt includes provider, objectId, byte size, encrypted SHA-256, upload timestamp and verification timestamp. Immutable providers cannot promise physical deletion; deletion hides an index only.

Future local/S3/Filecoin adapters must implement the same contract, bound download sizes, support cancellation and distinguish unavailable/corrupt/verified. Encrypt once and replicate identical ciphertext. Credentials and signed upload URLs must be scoped to the authenticated owner's object, size and expiry. Verification requires a fresh remote read and comparison against a trusted expected hash. Redundancy remains pending until independent copies have been retrieved and checked.
