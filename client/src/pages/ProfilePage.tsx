import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { AlertCircle, Check, Loader, Lock, User as UserIcon } from 'lucide-react'
import { auth as authApi } from '../api'
import type { User } from '../types'

// Extract a readable message from an API error, preferring Polish backend text.
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error) {
      return data.error
    }
  }
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
}

// SQLite timestamps are stored without a timezone; render date + time in local time.
function formatDateTime(value: string | undefined): string {
  if (!value) {
    return '—'
  }
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Change password form state.
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const user = await authApi.getMe()
      setProfile(user)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setSuccess(null)

    if (!currentPassword) {
      setFormError('Podaj obecne hasło.')
      return
    }
    if (newPassword.length < 4) {
      setFormError('Nowe hasło musi mieć co najmniej 4 znaki.')
      return
    }
    if (newPassword !== confirmPassword) {
      setFormError('Nowe hasła nie są identyczne.')
      return
    }

    setSaving(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Hasło zostało zmienione.')
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
        <Loader className="h-8 w-8 animate-spin text-neutral-400" aria-label="Ładowanie" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-4 text-center dark:bg-neutral-950">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="max-w-sm text-neutral-700 dark:text-neutral-300">
          {error ?? 'Nie udało się załadować profilu.'}
        </p>
        <button
          type="button"
          onClick={() => {
            void loadProfile()
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Loader className="h-4 w-4" />
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-6 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <UserIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Twoje konto</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Informacje o profilu i zmiana hasła
            </p>
          </div>
        </header>

        {/* Section 1: profile information */}
        <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Dane konta
          </h2>
          <dl className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Nazwa użytkownika</dt>
              <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                {profile.username}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Rola</dt>
              <dd>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    profile.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {profile.role === 'admin' ? 'Administrator' : 'Kierowca'}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Konto utworzone</dt>
              <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                {formatDateTime(profile.created_at)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Section 2: change password */}
        <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Zmień hasło
            </h2>
          </div>

          {success && (
            <div role="status" className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Obecne hasło
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Wpisz obecne hasło"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Nowe hasło
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="min. 4 znaki"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Potwierdź nowe hasło
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Powtórz nowe hasło"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            {formError && (
              <div role="alert" className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
              {saving ? 'Zmienianie…' : 'Zmień hasło'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}