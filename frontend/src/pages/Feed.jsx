import { useState, useEffect } from 'react'
import { useReadContract, useWalletClient } from 'wagmi'
import { Plus, FileText, Radio, ShieldCheck, Database } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PostRegistryABI from '../contracts/PostRegistry.json'
import PostCard from '../components/PostCard'
import CreatePostModal from '../components/CreatePostModal'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { isDemoMode } from '../config/demo'
import { DEMO_FEED_POSTS } from '../demo/demoFeed'
import { warmTurboForWallet, prepareFeedUpload } from '../lib/turboUpload'

const ZERO = '0x0000000000000000000000000000000000000000'

function FeedContent({ posts, contractsReady, onPost, onLike, onOpenCreate }) {
  return (
    <>
      <PageHeader
        eyebrow="Public ledger"
        title="Community"
        description={
          isDemoMode
            ? 'Demo posts — connect on Base Sepolia for the live feed.'
            : 'Public posts use testnet storage. Do not post private information.'
        }
        action={(
          <button
            type="button"
            onClick={onOpenCreate}
            disabled={contractsReady === false}
            className="btn-primary btn-primary-sm disabled:opacity-40"
          >
            <Plus size={17} />
            New post
          </button>
        )}
      />

      {contractsReady === false && (
        <div className="callout callout-warn mb-8">
          <p className="text-sm">Contracts not deployed yet. Deploy to Base Sepolia, then rebuild.</p>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing here yet"
          description="Create a public test post."
          action={(
            <button type="button" onClick={onOpenCreate} className="btn-primary btn-primary-sm">
              <Plus size={17} />
              Create post
            </button>
          )}
        />
      ) : (
        <div className="feed-layout">
          <div className="feed-list">
            {posts.map((post) => (
              <PostCard key={post.id.toString()} post={post} onLike={onLike} />
            ))}
          </div>
          <aside className="community-rail" aria-label="Community network information">
            <div className="community-rail-head"><Radio size={16} /><span><strong>Public signal</strong><small>Testnet community feed</small></span></div>
            <div className="community-fact"><ShieldCheck size={15} /><span><strong>Wallet-authored</strong><small>Every post has a verifiable sender</small></span></div>
            <div className="community-fact"><Database size={15} /><span><strong>Arweave-backed</strong><small>Content resolves from its storage ID</small></span></div>
            <p>Community posts are public. Keep personal and recovery information inside your encrypted vault.</p>
          </aside>
        </div>
      )}

    </>
  )
}

function DemoFeed() {
  const [showCreate, setShowCreate] = useState(false)
  const posts = [...DEMO_FEED_POSTS].reverse()

  return (
    <>
      <FeedContent
        posts={posts}
        onOpenCreate={() => setShowCreate(true)}
        onLike={() => {}}
      />
      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onSuccess={() => setShowCreate(false)} />
      )}
    </>
  )
}

function LiveFeed() {
  const [showCreate, setShowCreate] = useState(false)
  const [posts, setPosts] = useState([])
  const { data: walletClient } = useWalletClient()
  const contractsReady = CONTRACT_ADDRESSES.PostRegistry !== ZERO

  useEffect(() => {
    if (!walletClient) return
    warmTurboForWallet(walletClient)
  }, [walletClient])

  const { data: recentPosts, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PostRegistry,
    abi: PostRegistryABI.abi,
    functionName: 'getRecentPosts',
    args: [BigInt(0), BigInt(50)],
    query: { enabled: contractsReady },
  })

  useEffect(() => {
    if (recentPosts) {
      setPosts((prev) => {
        const chainPosts = [...recentPosts].reverse()
        const pending = prev.filter((p) => p._pending)
        const chainIds = new Set(chainPosts.map((p) => p.arweaveId))
        const stillPending = pending.filter((p) => !chainIds.has(p.arweaveId))
        return [...stillPending, ...chainPosts]
      })
    }
  }, [recentPosts])

  function handlePostSuccess(result) {
    if (result?.optimisticPost) {
      setPosts((prev) => {
        if (prev.some((p) => p.arweaveId === result.optimisticPost.arweaveId)) return prev
        return [result.optimisticPost, ...prev]
      })
    }
    setShowCreate(false)
    refetch()
  }

  return (
    <>
      <FeedContent
        posts={posts}
        contractsReady={contractsReady}
        onOpenCreate={() => setShowCreate(true)}
        onLike={refetch}
      />
      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onSuccess={handlePostSuccess}
        />
      )}
    </>
  )
}

export default function Feed() {
  if (isDemoMode) return <DemoFeed />
  return <LiveFeed />
}
