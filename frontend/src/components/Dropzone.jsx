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
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`dropzone ${dragging ? 'dropzone-active' : ''} ${filled ? 'dropzone-filled' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function DropzoneIcon({ children }) {
  return <div className="dropzone-icon">{children}</div>
}
