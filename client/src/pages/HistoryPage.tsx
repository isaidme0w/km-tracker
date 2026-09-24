import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gauge,
  History,
  Loader,
  RefreshCw,
  User,
} from 'lucide-react'
import { cycles as cyclesApi } from '../api'
import Pagination from '../components/Pagination'
import type { CycleHistoryItem } from '../types'

// Color palette cycled for the per-driver percentage bars.
const BAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-purple-600',
  'bg-rose-500',
  'bg-cyan-600',
]

// Number of trip entries shown per page in the odometer readings list.
const PAGE_SIZE = 5

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pl-PL').format(value)
}

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} zł`
}

function formatPercent(ratio: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(ratio)
}

// SQLite timestamps are stored without a timezone; render the date in local time.
function formatDate(value: string | null): string {
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

// SQLite timestamps are stored without a timezone; render date + time in local time.
function formatDateTime(value: string | null): string {
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

export default function HistoryPage() {
  const [history, setHistory] = useState<CycleHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [tripsPage, setTripsPage] = useState(1)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await cyclesApi.getHistory()
      setHistory(data)
      // Start on the newest cycle (API returns newest first, so its index in
      // the chronological ordering below is the last one).
      setIndex(data.length > 0 ? data.length - 1 : 0)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // Chronological ordering (oldest → newest) so "previous" means an earlier
  // cycle and "next" means a later one.
  const ordered = [...history].reverse()
  const activeCycle = ordered[index] ?? null

  const goPrevious = () => {
    setIndex((i) => Math.max(0, i - 1))
    setTripsPage(1)
  }
  const goNext = () => {
    setIndex((i) => Math.min(ordered.length - 1, i + 1))
    setTripsPage(1)
  }

  const tripsTotalPages = Math.max(1, Math.ceil((activeCycle?.trips.length ?? 0) / PAGE_SIZE))
  const tripsActivePage = Math.min(tripsPage, tripsTotalPages)
  const pagedTrips = (activeCycle?.trips ?? []).slice(
    (tripsActivePage - 1) * PAGE_SIZE,
    tripsActivePage * PAGE_SIZE,
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
        <Loader className="h-8 w-8 animate-spin text-neutral-400" aria-label="Ładowanie" />
      </div>
    )
  }

  if (error && history.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-4 text-center dark:bg-neutral-950">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="max-w-sm text-neutral-700 dark:text-neutral-300">{error}</p>
        <button
          type="button"
          onClick={() => {
            void loadHistory()
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
            <History className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Historia rozliczeń
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Zamknięte cykle i podział kosztów paliwa
            </p>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {history.length === 0 || !activeCycle ? (
          <div className="rounded-2xl bg-white p-10 text-center text-neutral-500 shadow-sm dark:bg-neutral-900 dark:text-neutral-400 dark:shadow-black/20">
            <History className="mx-auto mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-700" />
            <p>Brak historii cykli.</p>
            <p className="mt-1 text-sm">
              Pierwsze rozliczenie pojawi się po zatankowaniu samochodu.
            </p>
          </div>
        ) : (
          <>
            {/* Date range navigation: previous/next cycle arrows on the sides. */}
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm dark:bg-neutral-900 dark:shadow-black/20">
              <button
                type="button"
                onClick={goPrevious}
                disabled={index === 0}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Poprzedni cykl"
                title="Poprzedni cykl"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900 sm:text-base dark:text-neutral-100">
                  <Calendar className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate">
                    {formatDate(activeCycle.created_at)} → {formatDate(activeCycle.closed_at)}
                  </span>
                </span>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  Cykl {index + 1} z {ordered.length}
                </span>
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={index === ordered.length - 1}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Następny cykl"
                title="Następny cykl"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Selected cycle details. */}
            <article className="rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-neutral-900 dark:shadow-black/20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                  <Fuel className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">
                    Tankowanie: {formatCurrency(activeCycle.fuel_cost ?? 0)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1 text-neutral-900 dark:text-neutral-100">
                  <Gauge className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                  <span className="font-medium">{formatNumber(activeCycle.start_odometer)} km</span>
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                <span className="flex items-center gap-1 text-neutral-900 dark:text-neutral-100">
                  <Gauge className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                  <span className="font-medium">
                    {formatNumber(activeCycle.end_odometer ?? activeCycle.start_odometer)} km
                  </span>
                </span>
                <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                  Łącznie:{' '}
                  {formatNumber(
                    Math.max(
                      0,
                      (activeCycle.end_odometer ?? activeCycle.start_odometer) -
                        activeCycle.start_odometer,
                    ),
                  )}{' '}
                  km
                </span>
              </div>

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Udział kierowców
              </h3>

              {activeCycle.shares.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {activeCycle.shares.map((share, i) => {
                    const barColor = BAR_COLORS[i % BAR_COLORS.length]
                    const percentage = Math.round(share.share_percentage * 100)
                    return (
                      <div key={share.id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
                            <User className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                            {share.username}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400">
                            {formatNumber(share.distance)} km · {formatPercent(share.share_percentage)}
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
                            {formatCurrency(share.amount_due)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  Tankowanie bez przejazdów — brak kilometrów do rozliczenia.
                </p>
              )}

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Historia odczytów
              </h3>

              {activeCycle.trips.length > 0 ? (
                <>
                  <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
                    {pagedTrips.map((trip) => (
                      <li key={trip.id} className="flex items-center gap-3 py-3 text-sm">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          <User className="h-4 w-4" />
                        </span>
                        <span className="flex-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {trip.username}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {formatNumber(trip.odometer)} km (+{formatNumber(trip.distance)} km)
                        </span>
                        <span className="text-neutral-400 dark:text-neutral-500">
                          {formatDateTime(trip.created_at)}
                        </span>
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
                <p className="mt-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  Brak odczytów w tym cyklu.
                </p>
              )}
            </article>
          </>
        )}
      </div>
    </main>
  )
}