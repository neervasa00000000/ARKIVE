import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Heart, ExternalLink } from 'lucide-react'
import { PermanentDot } from './PermanentDot'
import { usePosts } from '../hooks/usePosts'
import toast from 'react-hot-toast'

export default function PostCard({ post, onLike }) {
  const { address } = useAccount()
  const { likePost } = usePosts()
  const [content, setContent] = useState(null)
  const [liking, setLiking] = useState(false)

  const arweaveId = post.arweaveId
  const isImage = post.contentType === 'image'
  const arweaveUrl = `https://arweave.net/${arweaveId}`

  useEffect(() => {
    if (!isImage) {
      fetch(arweaveUrl)
        .then(r => r.json())
        .then(data => setContent(data))
        .catch(() => setContent(null))
    }
  }, [arweaveId, isImage, arweaveUrl])

  async function handleLike() {
    if (liking) return
    setLiking(true)
    try {
      await likePost(Number(post.id))
      toast.success('+2 points awarded to creator')
      onLike?.()
    } catch (error) {
      if (error.message?.includes('Already liked')) {
        toast.error('Already liked this post')
      } else {
        toast.error('Like failed')
      }
    } finally {
      setLiking(false)
    }
  }

  const shortAddress = `${post.author.slice(0, 6)}...${post.author.slice(-4)}`
  const timeAgo = formatTimeAgo(Number(post.createdAt) * 1000)

  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-fade-in hover:border-border/80 transition-colors">

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-elevated border border-border flex items-center justify-center">
            <span className="font-mono text-xs text-text-secondary">
              {post.author.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-mono text-xs text-text-primary">{shortAddress}</p>
            <p className="font-body text-xs text-text-muted">{timeAgo}</p>
          </div>
        </div>
        <PermanentDot type="post" />
      </div>

      {isImage ? (
        <img
          src={arweaveUrl}
          alt="Post"
          className="w-full rounded-lg mb-4 object-cover max-h-96"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      ) : (
        <p className="font-body text-text-primary leading-relaxed mb-4">
          {content?.text || '...'}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <button
          onClick={handleLike}
          disabled={liking || post.author.toLowerCase() === address?.toLowerCase()}
          className="flex items-center gap-2 text-text-secondary hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Heart size={16} />
          <span className="font-body text-sm">{post.likes.toString()}</span>
        </button>

        <a
          href={arweaveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-text-muted hover:text-cyan-400 transition-colors"
        >
          <ExternalLink size={14} />
          <span className="font-mono text-xs">Arweave</span>
        </a>
      </div>
    </div>
  )
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
