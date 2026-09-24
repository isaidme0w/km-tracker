import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { Car, Gauge, History, LogOut, Menu, Moon, Sun, User, Users, X } from 'lucide-react'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

// Only authenticated users may access the nested routes behind this guard.
function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

// Restricts a route to users with the 'admin' role.
function AdminRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

// Shared shell: shows the navigation bar only when a user is signed in.
function AppLayout() {
  const { user } = useAuth()

  if (!user) {
    return <Outlet />
  }

  return (
    <>
      <NavBar />
      <Outlet />
    </>
  )
}

function navItemClass(isActive: boolean): string {
  return `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
  }`
}

function NavBar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = (
    <>
      <NavLink
        to="/"
        end
        className={({ isActive }) => navItemClass(isActive)}
        onClick={() => setMenuOpen(false)}
      >
        <Gauge className="h-4 w-4" />
        <span>Pulpit</span>
      </NavLink>
      <NavLink
        to="/history"
        className={({ isActive }) => navItemClass(isActive)}
        onClick={() => setMenuOpen(false)}
      >
        <History className="h-4 w-4" />
        <span>Historia</span>
      </NavLink>
      {user?.role === 'admin' && (
        <NavLink
          to="/admin"
          className={({ isActive }) => navItemClass(isActive)}
          onClick={() => setMenuOpen(false)}
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Panel administratora</span>
          <span className="sm:hidden">Panel</span>
        </NavLink>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Link to="/" className="mr-1 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Car className="h-5 w-5" />
          </span>
          <span className="hidden text-lg font-bold text-neutral-900 md:inline dark:text-neutral-100">
            KMTracker
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">{navItems}</nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
            title={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={menuOpen}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <User className="h-4 w-4" />
            <span className="max-w-[8rem] truncate">{user?.username}</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label="Wyloguj"
            title="Wyloguj"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={
          'grid overflow-hidden transition-all duration-300 ease-in-out md:hidden ' +
          (menuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')
        }
      >
        <nav className="mx-auto min-h-0 w-full max-w-3xl overflow-hidden">
          <div className="mt-2 flex flex-col gap-1 border-t border-neutral-100 pb-2 pt-2 dark:border-neutral-800">
            {navItems}
          </div>
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
    </Routes>
  )
}