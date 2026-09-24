# E05 gateway independence

ARKIVE retrieval currently tries `ar-io.dev`, an optional configured gateway, `turbo-gateway.ar.io`, `turbo-gateway.com`, and `arweave.net`, after checking IndexedDB. The archive identifier is a 43-character Arweave transaction/data-item ID; retrieval is `https://<gateway>/<id>`. Archive bytes include a plaintext header `contentHash` for ciphertext integrity, and the committed fixture records archive, ciphertext, and plaintext SHA-256 values.

Multiple hostnames are not by themselves independent. AR.IO documentation says anyone can operate a registered gateway and exposes operator metadata through its Gateway Address Registry. It also identifies `ar-io.dev` as a test gateway operated by PDS, while AR.IO gateway defaults use `turbo-gateway.com` as a trusted upstream. These facts make the configured endpoints plausible alternate paths but do not prove that this exact hostname set has independent operators or failure domains.

Primary references consulted on 2026-09-24:

- https://docs.ar.io/learn/gateways
- https://docs.ar.io/learn/gateways/gateway-registry
- https://docs.ar.io/sdks/ar-io-sdk/gateways
- https://docs.ar.io/build/run-a-gateway/manage/environment-variables

The committed fixture has no transaction/storage identifier. No historical disappearing fixture is used, and no upload or payment was attempted. E05 is therefore `SKIPPED`, not PASS or FAIL. A valid rerun requires the exact committed archive to already exist on Arweave or explicit approval for any upload and cost, plus two gateway operators whose independence can be established before failure injection.
