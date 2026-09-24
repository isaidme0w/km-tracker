import axios from 'axios'
import type {
  ActiveCycle,
  AuthResponse,
  ChangePasswordPayload,
  CreateUserPayload,
  CurrentOdometer,
  Cycle,
  CycleHistoryItem,
  CycleSetupPayload,
  LoginPayload,
  OdometerReading,
  RefuelPayload,
  RefuelResult,
  UpdateUserPayload,
  User,
} from './types'

// axios instance pointing at the Vite dev proxy (/api -> http://localhost:3001).
const api = axios.create({
  baseURL: '/api',
})

// Attach the JWT to every request so the backend can authorize it.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, drop the stale token and bounce back to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export const auth = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', payload)
    return data
  },
  getMe: async (): Promise<User> => {
    const { data } = await api.get<{ user: User }>('/auth/me')
    return data.user
  },
  changePassword: async (payload: ChangePasswordPayload): Promise<{ success: boolean }> => {
    const { data } = await api.post<{ success: boolean }>('/auth/change-password', payload)
    return data
  },
}

export const users = {
  list: async (): Promise<User[]> => {
    const { data } = await api.get<User[]>('/users')
    return data
  },
  create: async (payload: CreateUserPayload): Promise<User> => {
    const { data } = await api.post<User>('/users', payload)
    return data
  },
  update: async (id: number, payload: UpdateUserPayload): Promise<User> => {
    const { data } = await api.patch<User>(`/users/${id}`, payload)
    return data
  },
  delete: async (id: number): Promise<{ deleted: boolean; id: number }> => {
    const { data } = await api.delete<{ deleted: boolean; id: number }>(`/users/${id}`)
    return data
  },
}

export const odometer = {
  getCurrent: async (): Promise<CurrentOdometer> => {
    const { data } = await api.get<CurrentOdometer>('/odometer/current')
    return data
  },
  submit: async (payload: { odometer: number }): Promise<OdometerReading> => {
    const { data } = await api.post<OdometerReading>('/odometer', payload)
    return data
  },
  deleteTrip: async (id: number): Promise<{ deleted: boolean; id: number }> => {
    const { data } = await api.delete<{ deleted: boolean; id: number }>(`/odometer/${id}`)
    return data
  },
  updateTrip: async (
    id: number,
    payload: { odometer?: number; user_id?: number },
  ): Promise<OdometerReading> => {
    const { data } = await api.patch<OdometerReading>(`/odometer/${id}`, payload)
    return data
  },
}

export const cycles = {
  getActive: async (): Promise<ActiveCycle> => {
    const { data } = await api.get<ActiveCycle>('/cycles/active')
    return data
  },
  refuel: async (payload: RefuelPayload): Promise<RefuelResult> => {
    const { data } = await api.post<RefuelResult>('/cycles/refuel', payload)
    return data
  },
  getHistory: async (): Promise<CycleHistoryItem[]> => {
    const { data } = await api.get<CycleHistoryItem[]>('/cycles/history')
    return data
  },
  setup: async (payload: CycleSetupPayload): Promise<{ cycle: Cycle }> => {
    const { data } = await api.post<{ cycle: Cycle }>('/cycles/setup', payload)
    return data
  },
}

export default api