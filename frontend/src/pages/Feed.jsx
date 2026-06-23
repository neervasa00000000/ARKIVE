import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { Plus, FileText } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '../config/contracts'
import PostRegistryABI from '../contracts/PostRegistry.json'
import PostCard from '../components/PostCard'
import CreatePostModal from '../components/CreatePostModal'

export default function Feed() {
  const [showCreate, setShowCreate] = useState(false)
  const [posts, setPosts] = useState([])

  const { data: recentPosts, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PostRegistry,
    abi: PostRegistryABI.abi,
    functionName: 'getRecentPosts',
    args: [BigInt(0), BigInt(50)],
  })

  useEffect(() => {
    if (recentPosts) {
      setPosts([...recentPosts].reverse())
    }
  }, [recentPosts])

  return (
    <div className="max-w-2xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Feed</h1>
          <p className="font-body text-text-secondary text-sm mt-1">
            Every post is stored permanently on Arweave
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-cyan-400 text-base px-4 py-2.5 rounded-xl font-display font-semibold text-sm hover:bg-cyan-500 transition-colors"
        >
          <Plus size={18} />
          Post
        </button>
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FileText size={32} className="text-text-muted mx-auto mb-4" />
            <p className="font-body text-text-secondary">No posts yet. Be the first to post something permanently.</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id.toString()} post={post} onLike={refetch} />
          ))
        )}
      </div>

      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refetch() }}
        />
      )}
    </div>
  )
}
