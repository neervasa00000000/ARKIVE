export default function Dropzone({
  dragging,
  filled,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  children,
  className = '',
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.(event)
        }
      }}
      className={`dropzone ${dragging ? 'dropzone-active' : ''} ${filled ? 'dropzone-filled' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function DropzoneIcon({ children }) {
  return <div className="dropzone-icon">{children}</div>
}
