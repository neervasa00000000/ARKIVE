import { createContext, useContext, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

const ModalTitleContext = createContext(null)

export function Modal({ children, onClose, size = 'max-w-lg', zIndex = 'z-50' }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  const titleId = useId()
  closeRef.current = onClose

  useEffect(() => {
    const prev = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] === panelRef.current) closeRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [])

  function trapFocus(event) {
    if (event.key !== 'Tab') return
    const focusable = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((item) => item.getClientRects().length > 0)
    if (!focusable.length) { event.preventDefault(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus()
    }
  }

  return (
    <div
      className={`modal-overlay ${zIndex}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`modal-panel ${size}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <ModalTitleContext.Provider value={titleId}>{children}</ModalTitleContext.Provider>
      </div>
    </div>
  )
}

export function ModalHeader({ title, description, onClose, icon: Icon }) {
  const titleId = useContext(ModalTitleContext)
  return (
    <div className="modal-header">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className="modal-icon-wrap shrink-0">
              <Icon size={18} className="text-muted" />
            </span>
          )}
          <h2 id={titleId} className="font-display text-lg font-semibold text-ink truncate">
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
