import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store/AppStore'

const tabs = [
  { to: '/bills/new', label: 'New Bill', icon: '🧾' },
  { to: '/bills', label: 'Bills', icon: '📚' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/parties', label: 'Parties', icon: '🚛' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Layout() {
  const { business } = useStore()

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-gray-50">
      <header className="no-print brand-gradient sticky top-0 z-40 px-4 pb-3 pt-4 text-white shadow-[0_2px_12px_rgba(16,42,32,0.18)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">{business?.name ?? 'AAA FARM'}</h1>
            <p className="text-xs text-white/80">{business?.tagline ?? 'Mandi Billing'}</p>
          </div>
          <div className="text-right text-xs text-white/80">
            <div className="text-sm font-semibold text-white">{business?.phone || 'Katni Mandi'}</div>
            <div>{business?.address}</div>
            <div className="mt-0.5 text-[10px] font-medium tracking-wide text-white/70">Built by Prince Kachhwaha</div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 pb-24 pt-3">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-gray-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-5 px-1 py-1.5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/bills/new'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <span className={`text-xl leading-none ${t.to === '/bills/new' ? '' : ''}`}>{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
