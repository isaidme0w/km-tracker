import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import {
  AlertTriangle,
  Check,
  Fuel,
  Gauge,
  Loader,
  Pencil,
  RefreshCw,
  Trash2,
  TrendingUp,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { cycles as cyclesApi, odometer as odometerApi, users as usersApi } from '../api'
import { useAuth } from '../AuthContext'
import Pagination from '../components/Pagination'
import type { ActiveCycle, CurrentOdometer, RefuelResult, Trip, User as UserType } from '../types'

// Color palette cycled for the per-driver distance bars, matching the history view.
const BAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-purple-600',
  'bg-rose-500',
  'bg-cyan-600',
]

// Number of trip entries shown per page in the trips list.
const PAGE_SIZE = 5

// Extract a readable message from an API error, preferring the Polish
// message sent by the backend.
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error) {
      return data.error
    }
  }
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
}

// Format whole numbers with Polish thousand separators (e.g. 145 230).
function formatNumber(value: number): string {
  return new Intl.NumberFormat('pl-PL').format(value)
}

// Format monetary values as PLN with two decimals (e.g. 250,50 zł).
function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} zł`
}

// Format a 0..1 ratio as a percentage (e.g. 12,5%).
function formatPercent(ratio: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'percent', maximumFractionDigits: 1 }).format(
    ratio,
  )
}

// SQLite timestamps are stored without a timezone; render them in local time.
function formatDateTime(value: string): string {
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Parse a Polish-style decimal input (accepts comma) into a number.
function parseDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export default function DashboardPage() {
  const { user: currentUser } = useAuth()

  const [current, setCurrent] = useState<CurrentOdometer | null>(null)
  const [active, setActive] = useState<ActiveCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Quick odometer entry state.
  const [odometerInput, setOdometerInput] = useState('')
  const [odometerSaving, setOdometerSaving] = useState(false)
  const [odometerError, setOdometerError] = useState<string | null>(null)
  const [odometerSuccess, setOdometerSuccess] = useState<string | null>(null)

  // Refuel form / summary state.
  const [showRefuel, setShowRefuel] = useState(false)
  const [fuelCost, setFuelCost] = useState('')
  const [refuelOdometer, setRefuelOdometer] = useState('')
  const [refuelSaving, setRefuelSaving] = useState(false)
  const [refuelError, setRefuelError] = useState<string | null>(null)
  const [refuelSummary, setRefuelSummary] = useState<RefuelResult | null>(null)

  // First-run vehicle setup state (shown when there is no active cycle yet).
  const [setupOdometer, setSetupOdometer] = useState('')
  const [setupFuelCost, setSetupFuelCost] = useState('')
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null)

  // Trips list pagination and admin mutation (edit/delete) state.
  const [tripsPage, setTripsPage] = useState(1)
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null)
  const [deletingTrip, setDeletingTrip] = useState(false)
  const [deleteTripError, setDeleteTripError] = useState<string | null>(null)
  const [tripToEdit, setTripToEdit] = useState<Trip | null>(null)
  const [editOdometer, setEditOdometer] = useState('')
  const [editUserId, setEditUserId] = useState<number | ''>('')
  const [editUsers, setEditUsers] = useState<UserType[]>([])
  const [editUsersLoading, setEditUsersLoading] = useState(false)
  const [editingTrip, setEditingTrip] = useState(false)
  const [editTripError, setEditTripError] = useState<string | null>(null)

  // Fetch the current odometer state and active cycle in parallel. When
  // `showSpinner` is false, the refresh happens silently after an action.
  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
    }
    setError(null)

    try {
      const currentData = await odometerApi.getCurrent()
      let activeData: ActiveCycle | null = null
      try {
        activeData = await cyclesApi.getActive()
      } catch (err) {
        // A missing active cycle simply means first-run setup is still pending.
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          activeData = null
        } else {
          throw err
        }
      }
      setCurrent(currentData)
      setActive(activeData)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      if (showSpinner) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const lastOdometer = current?.currentOdometer ?? 0
  const totalDistance = active?.totalDistance ?? 0

  // Before setup, there is no active cycle at all — show the onboarding form.
  const needsInitialSetup = active === null

  // Trips are shown newest-first and split into pages.
  const isAdmin = currentUser?.role === 'admin'
  const orderedTrips = [...(active?.trips ?? [])].reverse()
  const tripsTotalPages = Math.max(1, Math.ceil(orderedTrips.length / PAGE_SIZE))
  const tripsActivePage = Math.min(tripsPage, tripsTotalPages)
  const pagedTrips = orderedTrips.slice(
    (tripsActivePage - 1) * PAGE_SIZE,
    tripsActivePage * PAGE_SIZE,
  )

  const odometerValue = Number(odometerInput)
  const hasOdometerValue = odometerInput.trim() !== '' && Number.isFinite(odometerValue)
  const odometerDelta = hasOdometerValue ? odometerValue - lastOdometer : 0
  const odometerValid = hasOdometerValue && odometerValue > lastOdometer

  const handleOdometerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOdometerError(null)
    setOdometerSuccess(null)

    if (!odometerValid) {
      setOdometerError('Nowy stan licznika musi być wyższy niż ostatni zanotowany stan.')
      return
    }

    setOdometerSaving(true)
    try {
      await odometerApi.submit({ odometer: odometerValue })
      setOdometerInput('')
      setOdometerSuccess('Zapisano nowy stan licznika.')
      await loadData(false)
    } catch (err) {
      setOdometerError(getErrorMessage(err))
    } finally {
      setOdometerSaving(false)
    }
  }

  const openRefuelForm = () => {
    setRefuelSummary(null)
    setRefuelError(null)
    setFuelCost('')
    setRefuelOdometer(String(lastOdometer))
    setShowRefuel(true)
  }

  const closeRefuelForm = () => {
    if (!refuelSaving) {
      setShowRefuel(false)
      setRefuelError(null)
    }
  }

  const handleRefuelSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRefuelError(null)

    const cost = parseDecimal(fuelCost)
    const odometer = Number(refuelOdometer)

    if (!Number.isFinite(cost) || cost < 0) {
      setRefuelError('Podaj prawidłową kwotę tankowania.')
      return
    }
    if (!Number.isFinite(odometer) || odometer < lastOdometer) {
      setRefuelError('Stan licznika nie może być niższy niż ostatni zanotowany stan.')
      return
    }

    setRefuelSaving(true)
    try {
      const result = await cyclesApi.refuel({ fuel_cost: cost, odometer })
      setRefuelSummary(result)
      setShowRefuel(false)
      await loadData(false)
    } catch (err) {
      setRefuelError(getErrorMessage(err))
    } finally {
      setRefuelSaving(false)
    }
  }

  const handleSetupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSetupError(null)
    setSetupSuccess(null)

    const odometer = Number(setupOdometer)
    const fuelCost = parseDecimal(setupFuelCost)

    if (!Number.isInteger(odometer) || odometer <= 0) {
      setSetupError('Stan licznika musi być liczbą całkowitą większą od zera.')
      return
    }
    if (!Number.isFinite(fuelCost) || fuelCost < 0) {
      setSetupError('Podaj prawidłową cenę ostatniego tankowania.')
      return
    }

    setSetupSaving(true)
    try {
      await cyclesApi.setup({ odometer, fuel_cost: fuelCost })
      setSetupOdometer('')
      setSetupFuelCost('')
      setSetupSuccess('Konfiguracja zakończona. Możesz już rejestrować przejazdy.')
      await loadData(false)
    } catch (err) {
      setSetupError(getErrorMessage(err))
    } finally {
      setSetupSaving(false)
    }
  }

  // Admin: delete a trip from the active cycle.
  const handleDeleteTrip = async () => {
    if (!tripToDelete) {
      return
    }
    setDeletingTrip(true)
    setDeleteTripError(null)
    try {
      await odometerApi.deleteTrip(tripToDelete.id)
      setTripToDelete(null)
      await loadData(false)
    } catch (err) {
      setDeleteTripError(getErrorMessage(err))
    } finally {
      setDeletingTrip(false)
    }
  }

  // Admin: open the edit modal and load the available drivers.
  const openEditTrip = async (trip: Trip) => {
    setTripToEdit(trip)
    setEditOdometer(String(trip.odometer))
    setEditUserId(trip.user_id)
    setEditTripError(null)
    setEditUsersLoading(true)
    try {
      const usersList = await usersApi.list()
      setEditUsers(usersList)
    } catch {
      setEditUsers([])
    } finally {
      setEditUsersLoading(false)
    }
  }

  const closeEditTrip = () => {
    if (!editingTrip) {
      setTripToEdit(null)
      setEditTripError(null)
    }
  }

  const closeDeleteTrip = () => {
    if (!deletingTrip) {
      setTripToDelete(null)
      setDeleteTripError(null)
    }
  }

  const handleEditTripSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tripToEdit) {
      return
    }
    setEditTripError(null)

    const odometer = Number(editOdometer)
    if (!Number.isInteger(odometer) || odometer <= 0) {
      setEditTripError('Stan licznika musi być liczbą całkowitą większą od zera.')
      return
    }
    if (editUserId === '') {
      setEditTripError('Wybierz kierowcę.')
      return
    }

    setEditingTrip(true)
    try {
      await odometerApi.updateTrip(tripToEdit.id, { odometer, user_id: Number(editUserId) })
      setTripToEdit(null)
      await loadData(false)
    } catch (err) {
      setEditTripError(getErrorMessage(err))
    } finally {
      setEditingTrip(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
        <Loader className="h-8 w-8 animate-spin text-neutral-400" aria-label="Ładowanie" />
      </div>
    )
  }

  if (error && !active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-4 text-center dark:bg-neutral-950">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="max-w-sm text-neutral-700 dark:text-neutral-300">{error}</p>
        <button
          type="button"
          onClick={() => {
            void loadData()
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
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {needsInitialSetup ? (
          <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
            <div className="mx-auto max-w-md">
              <div className="mb-6 text-center">
                <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                  <Wrench className="h-8 w-8" />
                </span>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Konfiguracja początkowa pojazdu
                </h2>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Podaj dane startowe, od których KMTracker rozpocznie naliczanie kilometrów i
                  rozliczanie paliwa.
                </p>
              </div>

              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="setupOdometer"
                    className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Stan licznika (km)
                  </label>
                  <input
                    id="setupOdometer"
                    name="setupOdometer"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={setupOdometer}
                    onChange={(event) => setSetupOdometer(event.target.value)}
                    placeholder="np. 145 230"
                    className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="setupFuelCost"
                    className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Cena ostatniego tankowania (zł)
                  </label>
                  <input
                    id="setupFuelCost"
                    name="setupFuelCost"
                    type="text"
                    inputMode="decimal"
                    value={setupFuelCost}
                    onChange={(event) => setSetupFuelCost(event.target.value)}
                    placeholder="np. 250,50"
                    className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>

                {setupError && (
                  <div role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{setupError}</span>
                  </div>
                )}

                {setupSuccess && (
                  <div
                    role="status"
                    className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{setupSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={setupSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {setupSaving ? <Loader className="h-5 w-5 animate-spin" /> : <Gauge className="h-5 w-5" />}
                  {setupSaving ? 'Zapisywanie…' : 'Zapisz i rozpocznij'}
                </button>
              </form>
            </div>
          </section>
        ) : (
          <>
            {/* Section 1: quick odometer entry */}
            <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
              <div className="mb-4 flex items-center gap-2">
                <Gauge className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Szybki wpis licznika
                </h2>
              </div>

              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Ostatni stan:{' '}
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatNumber(lastOdometer)} km
                </span>
              </p>

              <form onSubmit={handleOdometerSubmit} className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="odometer"
                    className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Nowy stan licznika
                  </label>
                  <input
                    id="odometer"
                    name="odometer"
                    type="number"
                    inputMode="numeric"
                    min={lastOdometer + 1}
                    placeholder={`np. ${formatNumber(lastOdometer + 1)}`}
                    value={odometerInput}
                    onChange={(event) => setOdometerInput(event.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />

                  {hasOdometerValue && (
                    <p
                      className={`mt-1 text-sm ${
                        odometerValid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {odometerValid
                        ? `+${formatNumber(odometerDelta)} km`
                        : 'Nowy stan musi być wyższy niż ostatni stan licznika.'}
                    </p>
                  )}
                </div>

                {odometerError && (
                  <div role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{odometerError}</span>
                  </div>
                )}

                {odometerSuccess && (
                  <div
                    role="status"
                    className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{odometerSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={odometerSaving || !odometerValid}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {odometerSaving ? <Loader className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  {odometerSaving ? 'Zapisywanie…' : 'Zapisz stan'}
                </button>
              </form>
            </section>

            {/* Section 2: active cycle summary */}
            <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Od ostatniego tankowania
                </h2>
              </div>

              <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-4 text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
                <Fuel className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">
                  Tankowanie: {formatCurrency(active?.cycle.fuel_cost ?? 0)}
                </span>
              </div>

              <div className="rounded-xl bg-blue-50 p-5 text-center dark:bg-blue-500/10">
                <p className="text-sm text-blue-700 dark:text-blue-400">Łącznie</p>
                <p className="mt-1 text-4xl font-bold text-blue-900 dark:text-blue-100">
                  {formatNumber(totalDistance)} km
                </p>
              </div>

              <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Kierowcy
              </h3>
              {active && active.drivers.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {active.drivers.map((driver, i) => {
                    const barColor = BAR_COLORS[i % BAR_COLORS.length]
                    const percentage = Math.round(driver.share_percentage * 100)
                    return (
                      <div key={driver.user_id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
                            <User className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                            {driver.username}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400">
                            {formatNumber(driver.distance)} km · {formatPercent(driver.share_percentage)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(driver.amount_due)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Brak przejazdów w tym cyklu.
                </p>
              )}

              <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Ostatnie przejazdy
              </h3>
              {active && active.trips.length > 0 ? (
                <>
                  <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
                    {pagedTrips.map((trip) => (
                      <li key={trip.id} className="flex items-center gap-2 py-3 text-sm sm:gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          <User className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {trip.username}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {formatNumber(trip.odometer)} km (+{formatNumber(trip.distance)} km)
                        </span>
                        <span className="text-neutral-400 dark:text-neutral-500">
                          {formatDateTime(trip.created_at)}
                        </span>

                        {isAdmin && (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void openEditTrip(trip)
                              }}
                              className="rounded-md p-1.5 text-neutral-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                              aria-label="Edytuj przejazd"
                              title="Edytuj przejazd"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTripToDelete(trip)}
                              className="rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              aria-label="Usuń przejazd"
                              title="Usuń przejazd"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    page={tripsActivePage}
                    totalPages={tripsTotalPages}
                    onPageChange={setTripsPage}
                  />
                </>
              ) : (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Brak zarejestrowanych przejazdów.
                </p>
              )}
            </section>

            {/* Section 3: refuel / settle cycle */}
            <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Tankowanie / Rozlicz cykl
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Zamknij bieżący cykl i podziel koszt paliwa między kierowców.
              </p>

              <button
                type="button"
                onClick={openRefuelForm}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <Fuel className="h-5 w-5" />
                Tankowanie / rozlicz cykl
              </button>

              {refuelSummary && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-900/20">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <Check className="h-5 w-5" />
                    <h3 className="font-semibold">Cykl został rozliczony</h3>
                  </div>
                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                    Łączny dystans: {formatNumber(refuelSummary.total_distance)} km
                  </p>

                  {refuelSummary.shares.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {refuelSummary.shares.map((share) => (
                        <li
                          key={share.user_id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm dark:bg-neutral-800"
                        >
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {share.username}
                          </span>
                          <span className="text-neutral-600 dark:text-neutral-300">
                            {formatNumber(share.distance)} km · {formatPercent(share.share_percentage)}
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(share.amount_due)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                      Brak przejazdów do rozliczenia.
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Refuel modal (bottom sheet on mobile, centered dialog on larger screens). */}
      {showRefuel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Tankowanie
              </h2>
              <button
                type="button"
                onClick={closeRefuelForm}
                disabled={refuelSaving}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {refuelError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{refuelError}</span>
              </div>
            )}

            <form onSubmit={handleRefuelSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="fuelCost"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Kwota za paliwo (zł)
                </label>
                <input
                  id="fuelCost"
                  name="fuelCost"
                  type="text"
                  inputMode="decimal"
                  placeholder="np. 250,50"
                  value={fuelCost}
                  onChange={(event) => setFuelCost(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>

              <div>
                <label
                  htmlFor="refuelOdometer"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Stan licznika przy tankowaniu
                </label>
                <input
                  id="refuelOdometer"
                  name="refuelOdometer"
                  type="number"
                  inputMode="numeric"
                  min={lastOdometer}
                  value={refuelOdometer}
                  onChange={(event) => setRefuelOdometer(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>

              <button
                type="submit"
                disabled={refuelSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refuelSaving ? <Loader className="h-5 w-5 animate-spin" /> : <Fuel className="h-5 w-5" />}
                {refuelSaving ? 'Rozliczanie…' : 'Rozlicz cykl'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete trip confirmation modal */}
      {tripToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-neutral-900">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Usuń przejazd</h2>
              </div>
              <button
                type="button"
                onClick={closeDeleteTrip}
                disabled={deletingTrip}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Czy na pewno chcesz usunąć przejazd{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {formatNumber(tripToDelete.odometer)} km
              </span>{' '}
              użytkownika{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {tripToDelete.username}
              </span>
              ?
            </p>

            {deleteTripError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{deleteTripError}</span>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  void handleDeleteTrip()
                }}
                disabled={deletingTrip}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 py-3 px-4 text-base font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingTrip ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
                {deletingTrip ? 'Usuwanie…' : 'Usuń'}
              </button>
              <button
                type="button"
                onClick={closeDeleteTrip}
                disabled={deletingTrip}
                className="inline-flex items-center justify-center rounded-lg bg-neutral-100 py-3 px-4 text-base font-semibold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit trip modal */}
      {tripToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-neutral-900">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Pencil className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Edytuj przejazd</h2>
              </div>
              <button
                type="button"
                onClick={closeEditTrip}
                disabled={editingTrip}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditTripSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="editOdometer"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Stan licznika (km)
                </label>
                <input
                  id="editOdometer"
                  name="editOdometer"
                  type="number"
                  inputMode="numeric"
                  value={editOdometer}
                  onChange={(event) => setEditOdometer(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>

              <div>
                <label
                  htmlFor="editUserId"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Kierowca
                </label>
                <select
                  id="editUserId"
                  name="editUserId"
                  value={String(editUserId)}
                  onChange={(event) => setEditUserId(Number(event.target.value))}
                  disabled={editUsersLoading}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  {editUsers.length === 0 ? (
                    <option value="">{editUsersLoading ? 'Ładowanie…' : 'Brak kierowców'}</option>
                  ) : (
                    editUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {editTripError && (
                <div role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{editTripError}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={editingTrip || editUsersLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 px-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingTrip ? <Loader className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  {editingTrip ? 'Zapisywanie…' : 'Zapisz zmiany'}
                </button>
                <button
                  type="button"
                  onClick={closeEditTrip}
                  disabled={editingTrip}
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