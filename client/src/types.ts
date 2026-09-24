// Shared frontend domain types mirroring the backend REST API responses.
// All monetary/value precision matches the server contract (see plans/).

export type Role = 'admin' | 'user'

export type CycleStatus = 'OPEN' | 'CLOSED'

export interface User {
  id: number
  username: string
  role: Role
  // Only present in admin user listings.
  is_protected?: number
  created_at?: string
}

export interface Cycle {
  id: number
  status: CycleStatus
  start_odometer: number
  end_odometer: number | null
  fuel_cost: number | null
  closed_at: string | null
  created_at: string
}

export interface Trip {
  id: number
  cycle_id: number
  user_id: number
  odometer: number
  distance: number
  created_at: string
  username: string
}

// Per-driver distance breakdown on the active cycle.
export interface DriverShare {
  user_id: number
  username: string
  distance: number
  share_percentage: number
  amount_due: number
}

export interface ActiveCycle {
  cycle: Cycle
  totalDistance: number
  drivers: DriverShare[]
  trips: Trip[]
}

export interface RefuelPayload {
  fuel_cost: number
  odometer: number
}

export interface CycleSetupPayload {
  odometer: number
  fuel_cost: number
}

// A single proportional cost split stored in a closed cycle.
export interface CycleShare {
  id: number
  cycle_id: number
  user_id: number
  distance: number
  share_percentage: number
  amount_due: number
  username: string
}

export interface CycleHistoryItem extends Cycle {
  shares: CycleShare[]
  trips: Trip[]
}

// --- Supporting types used by the API client methods ---

export interface LoginPayload {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface CreateUserPayload {
  username: string
  password: string
  role?: Role
}

export interface UpdateUserPayload {
  role?: Role
  password?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface OdometerEntry {
  id: number
  cycle_id: number
  user_id: number
  odometer: number
  distance: number
  created_at?: string
}

export interface OdometerReading {
  id: number
  cycle_id: number
  user_id: number
  odometer: number
  distance: number
}

export interface CurrentOdometer {
  currentOdometer: number
  cycle: Cycle | null
  lastEntry: OdometerEntry | null
}

// In refuel result, shares are computed on the fly (no id/cycle_id yet).
export interface RefuelShare {
  user_id: number
  username: string
  distance: number
  share_percentage: number
  amount_due: number
}

export interface RefuelResult {
  refuel_id: number
  closed_cycle_id: number
  next_cycle_id: number
  total_distance: number
  final_entry_id: number | null
  shares: RefuelShare[]
}