import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/backtest', label: 'Backtest Analyzer', icon: '📈' },
  { path: '/signals', label: 'AI Signal Tester', icon: '🔍' },
  { path: '/pine', label: 'Pine Script Gen', icon: '🌲' },
  { path: '/strategies', label: 'Strategy Library', icon: '📚' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="bg-grid min-h-screen relative">
      {/* Background glows */}
      <div className="bg-glow" style={{ top: '-200px', left: '-200px', background: 'rgba(99,102,241,0.06)' }} />
      <div className="bg-glow" style={{ bottom: '-200px', right: '-200px', background: 'rgba(6,182,212,0.04)' }} />

      {/* Mobile hamburger */}
      <button
        id="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-[60] md:hidden flex flex-col gap-1.5 p-2 rounded-lg"
        style={{ background: 'var(--color-bg-card)' }}
      >
        <span className="block w-5 h-0.5 bg-white rounded" />
        <span className="block w-5 h-0.5 bg-white rounded" />
        <span className="block w-5 h-0.5 bg-white rounded" />
      </button>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-cyan))' }}>
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight gradient-text">QuantPad</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>AI Trading Analysis</p>
            </div>
          </div>
        </div>

        <div className="px-2 mt-2">
          <p className="px-5 mb-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}>
            Tools
          </p>
          <nav className="flex flex-col gap-0.5">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-6 left-0 right-0 px-4">
          <div className="glass-card-static p-4 text-center">
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              100% Client-Side
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Your data never leaves your browser
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
