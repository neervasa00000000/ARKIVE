import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Heart, ExternalLink } from 'lucide-react'
import { PermanentDot } from './PermanentDot'
import { usePosts } from '../hooks/usePosts'
import { validateArweaveTxId } from '../lib/security'
import { fetchArweaveContent } from '../lib/arweaveCache'
import { isDemoMode } from '../config/demo'
import { DEMO_POST_CONTENT } from '../demo/demoFeed'
import toast from 'react-hot-toast'

export default function PostCard({ post, onLike }) {
  const { address } = useAccount()
  const { likePost } = usePosts()
  const [content, setContent] = useState(null)
  const [loadState, setLoadState] = useState('idle')
  const [liking, setLiking] = useState(false)

  const arweaveId = post.arweaveId
  const isImage = post.contentType === 'image'
  const isDemoPost = isDemoMode && arweaveId.startsWith('demo-feed-')

  const arweaveUrl = (() => {
    if (isDemoPost) return null
    try {
      return `https://arweave.net/${validateArweaveTxId(arweaveId)}`
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (post._optimisticText) {
      setContent({ text: post._optimisticText })
      setLoadState('ok')
      return
    }
    if (isImage || !arweaveId) return

    if (isDemoPost) {
      const demo = DEMO_POST_CONTENT[arweaveId]
      setContent(demo ? { text: demo.text } : null)
      setLoadState('ok')
      return
    }

    if (!arweaveUrl) {
      setLoadState('error')
      return
    }

    let cancelled = false
    setLoadState('loading')
    setContent(null)

    fetchArweaveContent(validateArweaveTxId(arweaveId))
      .then(({ body }) => {
        if (cancelled) return
        try {
          const data = JSON.parse(body)
          const text = typeof data?.text === 'string' ? data.text.slice(0, 5000) : null
          setContent(text ? { text } : null)
          setLoadState(text ? 'ok' : 'error')
        } catch {
          setLoadState('error')
        }
      })
      .catch(() => { if (!cancelled) setLoadState('error') })

    return () => { cancelled = true }
  }, [arweaveId, isImage, arweaveUrl, isDemoPost, post._optimisticText])

  async function handleLike() {
    if (liking || isDemoPost) return
    setLiking(true)
    try {
      await likePost(Number(post.id))
      toast.success('+2 points to creator')
      onLike?.()
    } catch (error) {
      toast.error(error.message?.includes('Already liked') ? 'Already liked' : 'Like failed')
    } finally {
      setLiking(false)
    }
  }

  const shortAddress = `${post.author.slice(0, 6)}…${post.author.slice(-4)}`
  const timeAgo = formatTimeAgo(Number(post.createdAt) * 1000)

  return (
    <article className="panel-hover p-5 animate-fade-in">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center shrink-0">
            <span className="font-mono text-[11px] text-muted">
              {post.author.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs text-ink truncate">{shortAddress}</p>
            <p className="text-xs text-faint mt-0.5">{timeAgo}</p>
          </div>
        </div>
        <PermanentDot type="post" />
      </header>

      {isImage && arweaveUrl ? (
        <img
          src={arweaveUrl}
          alt=""
          className="w-full rounded-xl mb-4 object-cover max-h-80 ring-1 ring-white/5"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      ) : (
        <PostBody loadState={loadState} content={content} />
      )}

      <footer className="flex items-center justify-between pt-4 mt-4 border-t border-line">
        <button
          type="button"
          onClick={handleLike}
          disabled={liking || isDemoPost || post.author.toLowerCase() === address?.toLowerCase()}
          className="flex items-center gap-2 text-muted hover:text-ink text-sm transition-colors disabled:opacity-30"
        >
          <Heart size={16} />
          {post.likes.toString()}
        </button>

        {arweaveUrl ? (
          <a
            href={arweaveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-faint hover:text-ink text-xs font-mono transition-colors"
          >
            <ExternalLink size={13} />
            arweave.net
          </a>
        ) : isDemoPost ? (
          <span className="text-xs font-mono text-faint">demo</span>
        ) : null}
      </footer>
    </article>
  )
}

function PostBody({ loadState, content }) {
  if (loadState === 'loading') {
    return <p className="text-muted text-sm italic">Loading from Arweave…</p>
  }
  if (loadState === 'error' || !content?.text) {
    return (
      <p className="text-amber-200/80 text-sm leading-relaxed">
        Content unavailable on Arweave. Try creating a new post.
      </p>
    )
  }
  return <p className="text-ink text-[15px] leading-relaxed">{content.text}</p>
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
