// All the calls to the backend for the Users page are in this file.
import type { Role, User } from '../types.ts'

// A user from GET /api/users: the users row plus the id of the desk they have (or null)
export type UserWithDesk = User & { desk_id: string | null }

// A row from GET /api/db/desks. There is no desk number in the database, just these three.
export type DbDesk = { desk_id: string; manufacturer: string; user_id: string | null }

// A failed call. `unavailable` is true when the backend is missing or down (so the page can say
// "not available yet" instead of showing a scary error).
export class ApiError extends Error {
  unavailable: boolean
  constructor(message: string, unavailable: boolean) {
    super(message)
    this.unavailable = unavailable
  }
}

// Sends one request and gives back the JSON. The backend sends errors as {"error": "..."}.
async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server.', true) // backend not running
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null) // null when the answer is not JSON
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Request failed (${res.status}).`
    throw new ApiError(message, [404, 502, 503, 504].includes(res.status) || data === null)
  }
  return data as T
}

export const getUsers = () => request<UserWithDesk[]>('/api/users')
export const getDesks = () => request<DbDesk[]>('/api/db/desks')

export const createUser = (body: { name: string; email: string; role: Role; desk_id?: string }) =>
  request<UserWithDesk>('/api/users', 'POST', body)

export const updateUser = (userId: string, body: { role?: Role; desk_id?: string | null }) =>
  request<UserWithDesk>(`/api/users/${encodeURIComponent(userId)}`, 'PATCH', body)

export const deleteUser = (userId: string) => request<void>(`/api/users/${encodeURIComponent(userId)}`, 'DELETE')
