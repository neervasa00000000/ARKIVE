import { useState, useRef } from 'react'
import { X, Image, Type, Upload } from 'lucide-react'
import { usePosts } from '../hooks/usePosts'
import toast from 'react-hot-toast'

export default function CreatePostModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()
  const { createPost, loading } = usePosts()

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (tab === 'text' && !text.trim()) {
      toast.error('Write something first')
      return
    }
    if (tab === 'image' && !image) {
      toast.error('Select an image')
      return
    }

    try {
      await createPost({ text: text.trim(), image: tab === 'image' ? image : null })
      toast.success('Posted permanently to Arweave')
      onSuccess?.()
    } catch (error) {
      toast.error('Post failed. Check your wallet.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-elevated border border-border rounded-2xl w-full max-w-lg animate-slide-up">

        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-text-primary">Create Post</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-border">
          {[{ id: 'text', label: 'Text', icon: Type }, { id: 'image', label: 'Image', icon: Image }].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                tab === id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'text' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What do you want to store permanently?"
              maxLength={2000}
              rows={5}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 font-body text-text-primary text-sm focus:outline-none focus:border-cyan-400 placeholder:text-text-muted resize-none"
            />
          ) : (
            <div>
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Preview" className="w-full rounded-xl max-h-64 object-cover" />
                  <button
                    onClick={() => { setImage(null); setPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current.click()}
                  className="w-full h-40 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 text-text-muted hover:border-cyan-400 hover:text-cyan-400 transition-colors"
                >
                  <Upload size={24} />
                  <span className="font-body text-sm">Click to select image</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>
          )}

          <p className="font-mono text-text-muted text-xs mt-3">
            This post will be stored permanently on Arweave. It cannot be deleted.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 font-body text-sm text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 bg-cyan-400 text-base px-5 py-2.5 rounded-xl font-display font-semibold text-sm hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Posting...' : 'Post Permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
