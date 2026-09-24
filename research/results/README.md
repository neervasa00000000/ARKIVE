# Experiment results

`npm run research:recovery` from `frontend/` creates:

- one timestamped directory containing immutable results for that run;
- `latest/` containing the most recent E01-E12 JSON files, aggregate JSON, and Markdown report;
- a clean-room result added as `latest/CLEAN-ROOM.json`.

Results contain fixture hashes and classifications, never credentials, decrypted bytes, AES keys, private keys, or seed phrases.
