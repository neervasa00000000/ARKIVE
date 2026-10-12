export default function WalletAvatar({ address, size }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        background: '#eae8e2',
        color: '#242523',
        borderRadius: 3,
        fontFamily: 'ui-monospace, monospace',
        fontSize: Math.max(10, Math.round(size * 0.3)),
        fontWeight: 500,
      }}
    >
      {address.slice(2, 4).toUpperCase()}
    </span>
  )
}
