# ARKIVE
**Your files. Permanent. Private. Only your wallet opens them.**

## What is this
ARKIVE is a personal vault built on blockchain. You upload a file, it encrypts in your browser before it ever touches the internet, then gets stored permanently on Filecoin and Arweave. The only way to get it back is signing in with the same wallet that uploaded it.

No company in the middle. No password resets. No customer support. No one who can lock you out or delete your things. Even if ARKIVE shuts down tomorrow, every file stays permanently accessible to the wallet that owns it. Forever.

## Why this exists
Skiff had over a million users. Notion acquired them and gave people a few weeks to export everything or lose it permanently. Google terminates accounts without warning. iCloud goes down. Platforms get acquired overnight.

Every single time this happens someone loses their wedding photos, their legal documents, their medical records — things that cannot be replaced. The person who lost everything did nothing wrong. They just trusted the wrong company.

ARKIVE makes that impossible.

## How it works
1. Connect your Ethereum wallet
2. Pick a file to upload
3. File encrypts in your browser before it leaves your device
4. Encrypted file stores permanently on Filecoin and Arweave via Irys SDK
5. Your wallet address and content hash are written to a smart contract on Base blockchain
6. To retrieve — sign a message with your wallet, file decrypts locally in your browser
7. Wrong wallet tries to access it — nothing happens, file stays encrypted permanently

No database. No server storing your data. The blockchain is everything.

## Tech stack
- Wallet connection — RainbowKit
- Encryption — AES client side in browser
- Permanent storage — Filecoin and Arweave via Irys SDK
- Access registry — Smart contract on Base blockchain
- Frontend — React

## Status
Currently in development. Funded by Filecoin Foundation grant application in progress.

First milestone: working MVP with wallet connect, encrypted upload, and wallet signature retrieval.

## Contact
Built by Neer Vasa — goosebumps0051@gmail.com

## Repository structure
```
ARKIVE/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── contracts/        ← smart contracts
├── frontend/         ← React app
├── docs/             ← documentation
└── scripts/          ← deployment scripts
```

## Development
See `docs/BUILD-GUIDE.md` for setup, environment variables, and deployment.
