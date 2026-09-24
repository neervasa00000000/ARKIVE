# E11 storage replica experiment

`run.mjs` copies the exact encrypted fixture bytes into two independent local directories, verifies both archive hashes, removes primary storage, and creates a fresh recovery environment containing only a copied standalone recovery tool and an archive retrieved from the replica. Network access is denied at process level.

```bash
node research/storage-replica/run.mjs
```

This is E11-A: controlled storage-location independence. It does not establish decentralized-network independence.

## E11-B future experiment

Store identical opaque archive bytes on Arweave and a genuinely independent decentralized storage network. The second network must have independent operation and failure domains, support exact opaque bytes, expose cryptographic content integrity and independently usable retrieval, document persistence and renewal semantics, avoid a mandatory central gateway, provide stable protocol tooling, and offer either a no-cost testnet or an explicitly approved cost envelope.

Candidate selection must evaluate operator/network independence, persistence model, retrieval protocol, price, integrity model, exact-byte support, APIs, gateway dependence, and testnet availability. No candidate has been selected and no upload is authorized by this experiment.
