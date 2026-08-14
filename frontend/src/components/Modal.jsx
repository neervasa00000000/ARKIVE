import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Modal({ children, onClose, size = 'max-w-lg', zIndex = 'z-50' }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className={`modal-overlay ${zIndex}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal-panel ${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, description, onClose, icon: Icon }) {
  return (
    <div className="modal-header">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className="modal-icon-wrap shrink-0">
              <Icon size={18} className="text-muted" />
            </span>
          )}
          <h2 className="font-display text-lg font-semibold text-ink truncate">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-muted text-sm mt-1.5 leading-relaxed pr-8">
            {description}
          </p>
        )}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          <X size={18} />
        </button>
      )}
    </div>
  )
}

export function ModalBody({ children, className = '' }) {
  return <div className={`modal-body ${className}`}>{children}</div>
}

export function ModalFooter({ children, className = '' }) {
  return <div className={`modal-footer ${className}`}>{children}</div>
}

export function ModalTabs({ tabs, active, onChange }) {
  return (
    <div className="modal-tabs">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`modal-tab ${active === id ? 'modal-tab-active' : ''}`}
        >
          {Icon && <Icon size={15} />}
          {label}
        </button>
      ))}
    </div>
  )
}
