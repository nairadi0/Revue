import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useSession } from '../hooks/useSession'
import { ActivityIcon, ChartIcon, LogoMark, RepoIcon } from './icons'
import s from './AppLayout.module.css'

const NAV = [
  { to: '/dashboard', label: 'Repositories', icon: RepoIcon },
  { to: '/runs', label: 'Runs', icon: ActivityIcon },
  { to: '/metrics', label: 'Metrics', icon: ChartIcon },
]

function AppLayout({ children }: { children: ReactNode }) {
  const user = useSession()

  return (
    <div className={s.shell}>
      <header className={s.bar}>
        <div className={s.barInner}>
          <Link to="/dashboard" className={s.brand}>
            <LogoMark />
            Revue
          </Link>
          <nav className={s.nav}>
            {NAV.map(({ to, label, icon: NavIcon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => [s.navLink, isActive ? s.navActive : ''].filter(Boolean).join(' ')}
              >
                <NavIcon size={15} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className={s.spacer} />
          {user && (
            <div className={s.user}>
              {user.avatar_url && <img className={s.avatar} src={user.avatar_url} alt="" />}
              <span>{user.username}</span>
            </div>
          )}
        </div>
      </header>
      <main className={s.main}>{children}</main>
    </div>
  )
}

export default AppLayout
