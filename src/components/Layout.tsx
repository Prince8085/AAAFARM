import { Link, NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store/AppStore'

const tabs = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', end: true },
  { to: '/bills', label: 'Bills', icon: '📚', end: false },
  null, // index 2 → center "+ New Bill" FAB
  { to: '/customers', label: 'Customers', icon: '👥', end: false },
  { to: '/parties', label: 'Parties', icon: '🚛', end: false },
]

export function Layout() {
  const { business } = useStore()

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-gray-50">
      <header className="no-print brand-gradient sticky top-0 z-40 px-4 pb-3 pt-4 text-white shadow-[0_2px_12px_rgba(16,42,32,0.18)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="AAA Farm logo"
              className="h-10 w-10 shrink-0 rounded-full object-cover shadow-md ring-2 ring-white/40"
            />
            <div>
              <h1 className="text-xl font-extrabold leading-tight tracking-tight">{business?.name ?? 'AAA FARM'}</h1>
              <p className="text-xs text-white/80">{business?.tagline ?? 'Mandi Billing'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right text-xs text-white/80">
              <div className="text-sm font-semibold text-white">{business?.phone || 'Katni Mandi'}</div>
              <div>{business?.address}</div>
              <div className="mt-0.5 text-[10px] font-medium tracking-wide text-white/70">Built by Prince Kachhwaha</div>
            </div>
            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              ⚙️
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 pb-28 pt-3">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-gray-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-5 px-1 pt-1.5">
          {tabs.map((t) => {
            if (!t) {
              return (
                <div key="fab" className="flex flex-col items-center">
                  <Link
                    to="/bills/new"
                    aria-label="New Bill"
                    className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-3xl font-bold text-white shadow-[0_4px_14px_rgba(16,42,32,0.35)] ring-4 ring-gray-50 transition-transform active:scale-95"
                  >
                    +
                  </Link>
                  <span className="mt-1 text-[10px] font-semibold text-gray-400">New Bill</span>
                </div>
              )
            }
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
