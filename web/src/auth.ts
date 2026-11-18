// Everything about logging in is in this file. When we connect the real database login,
// this should be the only file we need to change.
import type { Role, User } from './types.ts'

export type { Role, User }

// The roles, already named after the columns in db
export const ROLES: readonly Role[] = ['admin', 'worker', 'maintenance_worker']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  worker: 'Office worker',
  maintenance_worker: 'Maintenance',
}

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role)
}

// Right now this just makes up a fake user with the role you clicked.
// later, log in with Supabase Auth and return the user's row from the users table instead.
export async function login(role: Role): Promise<User> {
  return {
    user_id: `demo-${role}`,
    name: '(username)',
    email: `${role}@example.com`,
    role,
    created_at: new Date().toISOString(),
  }
}

// Saves the user in the browser, so you stay logged in when you refresh the page
const STORAGE_KEY = 'heighthub.user'

export function saveUser(user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearUser() {
  localStorage.removeItem(STORAGE_KEY)
}

export function loadUser(): User | null {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return user && typeof user.user_id === 'string' && isRole(user.role) ? user : null
  } catch {
    return null
  }
}
