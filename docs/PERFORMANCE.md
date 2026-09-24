# Frontend performance baseline

Measured from the production build on 24 September 2026 with `VITE_DEMO_MODE=false`.

The build passes, but Vite reports chunks larger than 500 KiB after minification. Representative emitted chunks vary by content hash but measured approximately:

| Chunk class | Raw | Gzip |
| --- | ---: | ---: |
| CSS entry | 82.18 KiB | 15.07 KiB |
| Web3 core | 525.32 KiB | 144.47 KiB |
| MetaMask SDK | 555.30 KiB | 169.76 KiB |
| Wallet/application dependency chunk | 904.37 KiB | 284.62 KiB |
| Large dependency chunk | 1,836.81 KiB | 122.98 KiB |
| Large Web3 bundle | 4,181.16 KiB | 1,498.37 KiB |
| Largest lazy/shared chunk | 4,215.35 KiB | 1,116.87 KiB |

This research task does not restructure production dependencies. Follow-up work should first generate a bundle-visualizer report, identify duplicate wallet SDKs and locale/assets, and then introduce measured code splitting without changing recovery behavior.
