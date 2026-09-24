# ARKIVE Recovery Dependency Surface analysis

## Scope and evidence rule

This analysis covers passphrase recovery of the committed synthetic v3/spec-v1 archive. Classifications are based on E01-E14, clean-room recovery, the independent Python interoperability experiment, and the E05/E11 specialized results. `UNKNOWN` is not treated as `NOT REQUIRED`.

## Dependency taxonomy

- **ESSENTIAL**: removal makes recovery impossible in the tested recovery model.
- **SUBSTITUTABLE**: a particular implementation/provider may disappear if a compatible replacement survives.
- **DISCOVERY-ONLY**: helps locate bytes but is unnecessary once exact archive bytes are held.
- **REDUNDANT**: one tested instance can disappear while another tested instance supplies equivalent functionality.
- **CONVENIENCE**: improves use but is unnecessary for the tested recovery path.
- **UNVALIDATED**: the proposed classification has not been experimentally demonstrated.

## Recovery function

For this evidence set:

`Recover(A, C, S, I, R) -> {success, failure}`

- `A`: intact encrypted archive bytes.
- `C`: valid passphrase credential.
- `S`: sufficient format/cryptographic knowledge.
- `I`: compatible recovery implementation.
- `R`: runtime providing SHA-256, PBKDF2-HMAC-SHA-256, and AES-256-GCM.

Successful recovery means authenticated decryption and exact SHA-256 equality with the original plaintext. Network, frontend, backend, registry, wallet application, browser state, and original storage location are parameters of acquisition or convenience, not inputs once `A` is locally available. That distinction does not prove they are unnecessary for discovering an unknown archive.

## Minimal Recovery Set

The current **candidate Minimal Recovery Set** for passphrase recovery is:

1. One intact encrypted archive object.
2. Its valid recovery passphrase.
3. Sufficient archive-format and cryptographic knowledge, represented by clarified Recovery Specification v1 and its conformance vectors.
4. A compatible implementation and runtime providing the required cryptographic primitives.

This is not an experimentally validated mathematical minimum. The credential failure was tested, but absence of archive bytes, all preserved format knowledge, all compatible implementations, and all suitable runtimes has not been exhaustively tested. E13 establishes cross-implementation conformance, and E14 demonstrates that a fresh isolated Java implementation can derive compatible recovery from the clarified specification and vectors without ARKIVE source or either prior implementation.

## Dependency matrix

| Dependency | Removed experimentally? | Recovery outcome | Alternative used | Classification | Evidence |
| --- | --- | --- | --- | --- | --- |
| ARKIVE frontend | Yes | Success | Standalone CLI | CONVENIENCE | E02, clean-room |
| ARKIVE backend | Yes | Success | Local archive | CONVENIENCE | E03, clean-room |
| Base RPC/network | Yes | Success after bytes acquired | Local archive | DISCOVERY-ONLY | E04 |
| VaultRegistry | Yes | Success after bytes acquired | Local archive | DISCOVERY-ONLY | E04 |
| Wallet application | Yes, passphrase path only | Success | Passphrase | SUBSTITUTABLE | E06 |
| Browser state | Yes | Success | Fresh filesystem process | CONVENIENCE | E07, clean-room |
| Local cache | Yes | Success | Explicit archive file | CONVENIENCE | E07 |
| Original gateway | No valid live fixture | Unknown | None | UNVALIDATED | E05 SKIPPED |
| Original storage location | Yes, controlled local failure domain | Success | Byte-identical local replica | SUBSTITUTABLE | E11-A |
| Original storage network | No | Unknown | None | UNVALIDATED | E11-B not run |
| Existing ARKIVE recovery implementation | Functionally replaced | Success | Independent Python implementation | SUBSTITUTABLE | INDEPENDENT-RECOVERY functional PASS |
| Archive-format knowledge | Insufficiency observed | Recovery required unstated assumptions | Source audit and clarified spec | ESSENTIAL in candidate set | INDEPENDENT-RECOVERY, E13 |
| Recovery Specification document | Used as sole format authority in blind implementation | Success | Equivalent preserved implementation/knowledge | SUBSTITUTABLE representation and validated knowledge carrier | E13, E14 |
| ARKIVE source code | Yes for independent execution | Success | Public spec, vectors, fresh Java implementation | SUBSTITUTABLE | INDEPENDENT-RECOVERY, E13, E14 |
| Valid credential | Wrong credential tested | Rejected | None | ESSENTIAL for tested path | E08, INDEPENDENT-RECOVERY |
| Intact encrypted archive bytes | Corruption tested, absence not tested | Rejected when corrupted | None | ESSENTIAL for tested path | E09 |
| Node runtime | No | Unknown | Python works for independent path | SUBSTITUTABLE runtime suggested, not fully classified | INDEPENDENT-RECOVERY |
| Cryptographic primitives | No | Unknown | Independent library used | UNVALIDATED | Removal not run |
| Wallet application | Yes, E15 synthetic EOA wallet-wrap only | Success | Raw synthetic private key plus ethers/eth-account signing | REMOVABLE for tested wallet-wrap fixture | E15 |
| Wallet integration stack | Yes, E15 synthetic EOA wallet-wrap only | Success | No MetaMask, RainbowKit, wagmi, WalletConnect, browser, frontend hooks, backend, Base RPC, or VaultRegistry runtime lookup | REMOVABLE for tested wallet-wrap fixture | E15 |
| Authorized private-key capability | Wrong key tested | Rejected | None | REQUIRED for wallet-wrap path | E15 |
| EIP-712 semantics/domain/types/message | Modified values tested | Rejected | None | REQUIRED for wallet-wrap path | E15 |
| Signature representation | Variant tested | `v = 0/1` still verified but produced a different Keccak/wrap key and failed recovery | REQUIRED for wallet-wrap path | E15 |
| Signature reproducibility | Compared across ethers 6.17.0 and eth-account 0.14.0 | Byte-identical signature and recovery success | SUBSTITUTABLE for tested vector only | E15 |

## Claim ladder

### Experimentally demonstrated

- Exact passphrase recovery works without the ARKIVE frontend, backend, Base, VaultRegistry, wallet application, browser state, local cache, or network once archive bytes are available (E01-E04, E06-E07, clean-room).
- Wrong credentials and authenticated corruption fail closed (E08-E10, E12, independent recovery negatives).
- A separately authored Python implementation using conventional interpretations produces byte-identical output to the Node CLI and expected plaintext.
- The encrypted archive object is storage-location neutral in controlled E11-A: a byte-identical local replica remains recoverable after the primary path is removed.
- Clarified Recovery Specification v1 and published vectors produce identical deterministic values, plaintext hashes, and negative classifications in Node and Python (E13 specification conformance PASS).
- A fresh isolated Java implementation using only the specification, vectors, fixture, and test credential passed 33/33 checks and recovered the expected plaintext hash without consulting forbidden source (E14 PASS).
- E15 recovered a synthetic EOA wallet-wrapped v3 archive without wallet applications, browser wallet integrations, ARKIVE frontend hooks, backend, Base RPC, VaultRegistry runtime lookup, network, browser state, or local application cache. ethers 6.17.0 and eth-account 0.14.0 produced byte-identical signatures for the tested EIP-712 vector, yielding identical Keccak wrap keys, unwrapped file keys, and plaintext hash.

### Strongly suggested but not completely demonstrated

- The existing Node and Python recovery implementations are replaceable for the tested passphrase path; E14 supplies the fresh specification-only implementation evidence.
- Node itself is replaceable by another runtime with compatible primitives. Python demonstrated one alternative, but runtime-removal coverage is not exhaustive.
- A genuinely independent Arweave gateway should be substitutable. E05 needs the exact committed fixture on Arweave and verified independent operators.
- E15 suggests wallet-wrap recovery can be implemented outside the original wallet application and frontend stack when the recoverer has equivalent raw private-key authority and the signing stack reproduces the same signature representation. This is bounded to the synthetic EOA vector and should not be generalized to all wallets, hardware signers, account abstraction wallets, or non-deterministic signing implementations.

### Not demonstrated

- Long-term or century-scale permanence.
- Future cryptographic or archive-format compatibility.
- Wallet recovery across all wallet applications, hardware wallets, account abstraction wallets, and non-deterministic/provider-specific signing implementations.
- Gateway independence for the committed fixture.
- Cross-network decentralized storage independence or all-storage-network independence.
- Production reliability, security-audit assurance, or research novelty.

## Next failure experiments

1. **E05 funded-environment experiment**: with explicit approval, place the exact fixture on Arweave and retrieve through two operator-verified independent gateways while blocking path A.
2. **E11-B independent network**: after selecting a network against the documented criteria and approving costs, store identical opaque bytes on a separate decentralized network and recover with Arweave entirely absent.
3. **Wallet-wrap blind conformance**: repeat E15 with a blind implementation and additional signer families, including hardware-wallet-style and account-abstraction cases.

Subsequent priorities are wallet/private-key recovery without a wallet application, runtime removal, and explicit archive/crypto migration experiments.
