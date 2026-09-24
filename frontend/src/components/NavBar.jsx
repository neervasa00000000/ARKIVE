import { Link, useLocation } from 'react-router-dom'
import { Archive, MessagesSquare, Settings } from 'lucide-react'

const links = [
  { path: '/vault', label: 'Vault', icon: Archive },
  { path: '/community', label: 'Community', icon: MessagesSquare },
  { path: '/profile', label: 'Settings', icon: Settings },
]

export function SidebarNav({ onNavigate }) {
  const location = useLocation()

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {links.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <Link
            key={path}
            to={path}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
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
    <nav aria-label="Primary" className="flex items-center justify-around px-1 py-2">
      {links.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <Link
            key={path}
            to={path}
            aria-current={active ? 'page' : undefined}
            className={`mobile-nav-link ${active ? 'mobile-nav-link-active' : ''} ${
              active ? 'text-ink' : 'text-muted'
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
