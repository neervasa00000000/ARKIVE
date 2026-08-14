import { DEMO_ADDRESS } from '../config/demo'

export const DEMO_FEED_POSTS = [
  {
    id: 0n,
    author: DEMO_ADDRESS,
    arweaveId: 'demo-feed-text-001',
    contentType: 'text',
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 3600),
    likes: 3n,
    exists: true,
  },
  {
    id: 1n,
    author: DEMO_ADDRESS,
    arweaveId: 'demo-feed-text-002',
    contentType: 'text',
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
    likes: 12n,
    exists: true,
  },
]

export const DEMO_POST_CONTENT = {
  'demo-feed-text-001': {
    text: 'Welcome to ARKIVE demo mode. Connect a wallet on Base Sepolia for live on-chain posts.',
  },
  'demo-feed-text-002': {
    text: 'Every real post is stored on Arweave forever. Your wallet is the only key.',
  },
}
