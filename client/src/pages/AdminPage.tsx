import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  Check,
  Loader,
  Lock,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { users as usersApi } from '../api'
import { useAuth } from '../AuthContext'
import type { Role, UpdateUserPayload, User } from '../types'

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

// Format the account creation timestamp in pl-PL (date only).
function formatDate(value: string | undefined): string {
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
  }).format(date)
}

export default function AdminPage() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create user form state.
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Delete flow state.
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)

  // Edit flow state.
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<Role>('user')
  const [editPassword, setEditPassword] = useState('')
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)

  // Load users. `showSpinner` is false for silent refreshes after mutations.
  const loadUsers = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
    }
    setError(null)

    try {
      const data = await usersApi.list()
      setUsers(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      if (showSpinner) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setCreateError('Nazwa użytkownika musi mieć co najmniej 3 znaki.')
      return
    }
    if (password.length < 4) {
      setCreateError('Hasło musi mieć co najmniej 4 znaki.')
      return
    }

    setCreating(true)
    try {
      await usersApi.create({ username: trimmedUsername, password, role })
      setUsername('')
      setPassword('')
      setRole('user')
      setCreateSuccess(`Dodano użytkownika „${trimmedUsername}”.`)
      await loadUsers(false)
    } catch (err) {
      setCreateError(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!userToDelete) {
      return
    }

    setDeleting(true)
    setDeleteError(null)
    try {
      await usersApi.delete(userToDelete.id)
      setDeleteSuccess(`Usunięto użytkownika „${userToDelete.username}”.`)
      setUserToDelete(null)
      await loadUsers(false)
    } catch (err) {
      setDeleteError(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = (user: User): boolean => {
    return user.is_protected !== 1 && user.id !== currentUser?.id
  }

  // Protected default admin cannot be edited.
  const canEdit = (user: User): boolean => {
    return user.is_protected !== 1
  }

  const openEditModal = (user: User) => {
    setEditError(null)
    setEditSuccess(null)
    setEditPassword('')
    setEditRole(user.role)
    setUserToEdit(user)
  }

  const closeEditModal = () => {
    if (!editing) {
      setUserToEdit(null)
      setEditError(null)
    }
  }

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userToEdit) {
      return
    }
    setEditError(null)
    setEditSuccess(null)

    const newPassword = editPassword.trim()
    if (newPassword && newPassword.length < 4) {
      setEditError('Hasło musi mieć co najmniej 4 znaki.')
      return
    }

    setEditing(true)
    try {
      const payload: UpdateUserPayload = { role: editRole }
      if (newPassword) {
        payload.password = newPassword
      }
      await usersApi.update(userToEdit.id, payload)
      setEditSuccess(`Zapisano zmiany dla użytkownika „${userToEdit.username}”.`)
      setUserToEdit(null)
      await loadUsers(false)
    } catch (err) {
      setEditError(getErrorMessage(err))
    } finally {
      setEditing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
        <Loader className="h-8 w-8 animate-spin text-neutral-400" aria-label="Ładowanie" />
      </div>
    )
  }

  if (error && users.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-4 text-center dark:bg-neutral-950">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="max-w-sm text-neutral-700 dark:text-neutral-300">{error}</p>
        <button
          type="button"
          onClick={() => {
            void loadUsers()
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
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
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Panel administratora
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Zarządzanie kierowcami i kontami
            </p>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {deleteSuccess && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{deleteSuccess}</span>
          </div>
        )}

        {editSuccess && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{editSuccess}</span>
          </div>
        )}

        {/* Section 1: add a new driver */}
        <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Dodaj kierowcę
            </h2>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Nazwa użytkownika / Login
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="np. jan.kowalski"
                className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="min. 4 znaki"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Rola
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                <option value="user">Kierowca</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {createError && (
              <div role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div role="status" className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? <Loader className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {creating ? 'Dodawanie…' : 'Dodaj kierowcę'}
            </button>
          </form>
        </section>

        {/* Section 2: user list */}
        <section className="rounded-2xl bg-white shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
          <div className="flex items-center gap-2 border-b border-neutral-100 p-5 dark:border-neutral-800">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Lista użytkowników
            </h2>
            <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {users.length}
            </span>
          </div>

          {users.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Brak użytkowników.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {users.map((user) => {
                const deletable = canDelete(user)
                const editable = canEdit(user)
                return (
                  <li key={user.id} className="flex items-center gap-3 p-4 sm:p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      <Users className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                          {user.username}
                        </span>
                        {user.id === currentUser?.id && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                            To Ty
                          </span>
                        )}
                        {user.is_protected === 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            <Shield className="h-3.5 w-3.5" />
                            Konto chronione
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}
                        >
                          {user.role === 'admin' ? 'Administrator' : 'Kierowca'}
                        </span>
                        <span>Utworzono: {formatDate(user.created_at)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      disabled={!editable}
                      title={
                        editable ? 'Edytuj użytkownika' : 'Nie można edytować chronionego konta'
                      }
                      aria-label="Edytuj użytkownika"
                      className="rounded-lg p-2 text-neutral-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400 dark:hover:bg-blue-500/10 dark:disabled:hover:text-neutral-500"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserToDelete(user)}
                      disabled={!deletable}
                      title={
                        deletable
                          ? 'Usuń użytkownika'
                          : 'Nie można usunąć chronionego ani własnego konta'
                      }
                      className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400 dark:hover:bg-red-500/10 dark:disabled:hover:text-neutral-500"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Delete confirmation modal */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-neutral-900">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Usuń użytkownika</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deleting) {
                    setUserToDelete(null)
                    setDeleteError(null)
                  }
                }}
                disabled={deleting}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Czy na pewno chcesz usunąć użytkownika{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {userToDelete.username}
              </span>
              ? Tej operacji nie można cofnąć.
            </p>

            {deleteError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  void handleDelete()
                }}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 py-3 px-4 text-base font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? <Loader className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                {deleting ? 'Usuwanie…' : 'Usuń'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deleting) {
                    setUserToDelete(null)
                    setDeleteError(null)
                  }
                }}
                disabled={deleting}
                className="inline-flex items-center justify-center rounded-lg bg-neutral-100 py-3 px-4 text-base font-semibold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {userToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-neutral-900">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Pencil className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Edytuj użytkownika</h2>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editing}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Edytujesz użytkownika{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {userToEdit.username}
              </span>
              .
            </p>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="editRole" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Rola
                </label>
                <select
                  id="editRole"
                  name="editRole"
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value as Role)}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  <option value="user">Kierowca</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="editPassword"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Nowe hasło
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    id="editPassword"
                    name="editPassword"
                    type="password"
                    autoComplete="new-password"
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    placeholder="min. 4 znaki"
                    className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-11 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  Pozostaw puste, aby nie zmieniać hasła.
                </p>
              </div>

              {editError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={editing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 px-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editing ? <Loader className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  {editing ? 'Zapisywanie…' : 'Zapisz zmiany'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editing}
                  className="inline-flex items-center justify-center rounded-lg bg-neutral-100 py-3 px-4 text-base font-semibold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}