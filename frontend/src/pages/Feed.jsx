import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { Plus, FileText, RotateCw } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PostRegistryABI from '../contracts/PostRegistry.json'
import PostCard from '../components/PostCard'
import CreatePostModal from '../components/CreatePostModal'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { isDemoMode } from '../config/demo'
import { useDemoWallet } from '../context/DemoWalletContext'
import { DEMO_FEED_POSTS } from '../demo/demoFeed'
import { mergeRecentPosts } from '../lib/feedPosts'

const ZERO = '0x0000000000000000000000000000000000000000'

function FeedContent({ posts, contractsReady, onLike, onOpenCreate, loading, failed, retry, retrying }) {
  return (
    <div className="community-page">
      <PageHeader
        eyebrow="Public ledger"
        title="Community"
        description="Public posts. Keep private information in your vault."
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
          <p className="text-sm">Community is not configured.</p>
        </div>
      )}

      {posts.length > 0 && retry && <div className="feed-refresh"><button type="button" className="btn-ghost btn-compact" disabled={retrying} onClick={() => retry()}><RotateCw size={14} />{retrying ? 'Refreshing…' : 'Refresh'}</button>{failed && <span role="status">Couldn’t refresh. Your loaded posts are still here.</span>}</div>}
      {loading ? <div className="archive-loading" role="status">Loading posts…</div> : failed && posts.length === 0 ? (
        <div className="callout callout-warn" role="alert"><div><strong>Couldn’t load posts.</strong><p>Check your connection and try again.</p></div><button type="button" className="btn-secondary" disabled={retrying} onClick={retry}><RotateCw size={16} /> Retry</button></div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing here yet"
          description={isDemoMode ? 'Add a demo post to this session.' : 'Create a public test post.'}
          action={(
            <button type="button" onClick={onOpenCreate} disabled={contractsReady === false} className="btn-primary btn-primary-sm">
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

        </div>
      )}

    </div>
  )
}

function DemoFeed() {
  const [showCreate, setShowCreate] = useState(false)
  const { feedPosts: newPosts, addFeedPost } = useDemoWallet()
  const posts = [...newPosts, ...DEMO_FEED_POSTS].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))

  function handleDemoPost(result) {
    if (result?.optimisticPost) addFeedPost(result.optimisticPost)
    setShowCreate(false)
  }

  return (
    <>
      <FeedContent
        posts={posts}
        onOpenCreate={() => setShowCreate(true)}
        onLike={() => {}}
      />
      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onSuccess={handleDemoPost} />
      )}
    </>
  )
}

function LiveFeed() {
  const [showCreate, setShowCreate] = useState(false)
  const [posts, setPosts] = useState([])
  const contractsReady = CONTRACT_ADDRESSES.PostRegistry !== ZERO

  const { data: recentPosts, refetch, isPending, isError, isFetching } = useReadContract({
    address: CONTRACT_ADDRESSES.PostRegistry,
    abi: PostRegistryABI.abi,
    functionName: 'getRecentPosts',
    args: [BigInt(0), BigInt(50)],
    query: { enabled: contractsReady, refetchInterval: 15_000, staleTime: 10_000 },
  })

  useEffect(() => {
    if (recentPosts) {
      setPosts((prev) => mergeRecentPosts(prev, recentPosts))
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
        loading={contractsReady && isPending}
        failed={isError}
        retry={refetch}
        retrying={isFetching}
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
