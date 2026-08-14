import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Lock, User } from 'lucide-react'

const links = [
  { path: '/', label: 'Feed', icon: LayoutGrid },
  { path: '/vault', label: 'Vault', icon: Lock },
  { path: '/profile', label: 'Profile', icon: User },
]

export function SidebarNav({ onNavigate }) {
  const location = useLocation()

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <Link
            key={path}
            to={path}
            onClick={onNavigate}
            className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.5} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function MobileNav() {
  const location = useLocation()

  return (
    <nav className="flex items-center justify-around px-2 py-2">
      {links.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              active ? 'text-ink' : 'text-faint'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/* Keep export for Layout compat */
export function ProfileNavLink() {
  return null
}

export default SidebarNav
