import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Lock, User, Shield } from 'lucide-react'

const nav = [
  { path: '/', label: 'Feed', icon: LayoutGrid },
  { path: '/vault', label: 'Vault', icon: Lock },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/recover', label: 'Recovery', icon: Shield },
]

export default function NavBar({ variant = 'desktop' }) {
  const location = useLocation()

  if (variant === 'mobile') {
    return (
      <div className="flex items-center justify-around py-3">
        {nav.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${
              location.pathname === path ? 'text-cyan-400' : 'text-text-secondary'
            }`}
          >
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="hidden md:flex items-center gap-1">
      {nav.map(({ path, label, icon: Icon }) => (
        <Link
          key={path}
          to={path}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            location.pathname === path
              ? 'bg-elevated text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-card'
          }`}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </div>
  )
}
