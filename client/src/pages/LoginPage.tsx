import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Car, Loader, Lock, LogIn, Moon, Sun, User } from 'lucide-react'
import { auth as authApi } from '../api'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'

// Extract a human-readable message from a failed login request, preferring
// the Polish error string returned by the backend.
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error) {
      return data.error
    }
  }
  return 'Wystąpił błąd podczas logowania. Spróbuj ponownie.'
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already-authenticated users are sent straight to the dashboard.
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/', { replace: true })
    }
  }, [isLoading, user, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { token, user: loggedUser } = await authApi.login({ username, password })
      login(token, loggedUser)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  // While the auth token is being verified on startup, avoid a flash of the
  // login form for users who already have a valid session.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
        <Loader className="h-8 w-8 animate-spin text-neutral-400" aria-label="Ładowanie" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
        title={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
        className="absolute right-4 top-4 inline-flex items-center justify-center rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
            <Car className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            KMTracker
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Rozliczanie kosztów paliwa
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 dark:bg-neutral-900 dark:shadow-black/20">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Login
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Nazwa użytkownika"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Hasło
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Twoje hasło"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Logowanie…
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Zaloguj się
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}