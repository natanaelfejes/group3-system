import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, createUser, deleteUser, getDesks, getUsers, updateUser } from '../../api/users.ts'
import type { DbDesk, UserWithDesk } from '../../api/users.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { ROLES, ROLE_LABELS } from '../../auth.ts'
import type { Role } from '../../auth.ts'

// Only the admin can open this page

// Only office workers have a desk. Admin and maintenance show "–" in the desk column.
function hasDesk(role: Role) {
  return role === 'worker'
}

// There is no desk number in the database, so a desk is named by its maker and the first 4 letters of its id.
// For example "Linak 3fa1 (free)".
function deskLabel(desk: DbDesk) {
  return `${desk.manufacturer} ${desk.desk_id.slice(0, 4)}${desk.user_id ? '' : ' (free)'}`
}

// The desks a user can pick: all free desks, plus the desk they already have.
function deskChoices(desks: DbDesk[], user?: UserWithDesk) {
  return desks.filter((desk) => desk.user_id === null || desk.desk_id === user?.desk_id)
}

export function UsersPage() {
  const [users, setUsers] = useState<UserWithDesk[]>([])
  const [desks, setDesks] = useState<DbDesk[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false) // the backend is missing or down
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  // Which dialog is open: 'new' = New user, a user = Edit that user, null = none
  const [editing, setEditing] = useState<UserWithDesk | 'new' | null>(null)
  const [deleting, setDeleting] = useState<UserWithDesk | null>(null)

  // Loads both lists again. We do this after every change, so the page always shows what the backend has.
  async function load() {
    try {
      const [newUsers, newDesks] = await Promise.all([getUsers(), getDesks()])
      setUsers(newUsers)
      setDesks(newDesks)
      setUnavailable(false)
      setError('')
    } catch (e) {
      if (e instanceof ApiError && e.unavailable) setUnavailable(true)
      else setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    setLoading(false)
  }

  useEffect(() => {
    // Loading the data when the page opens is exactly what an effect is for (the setState calls happen after the await)
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [])

  // Runs a change (like a new role) and then reloads. If it fails, the error shows on the page.
  async function change(action: () => Promise<unknown>) {
    try {
      await action()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    await load()
  }

  const query = search.trim().toLowerCase()
  const shown = users.filter(
    (user) =>
      (roleFilter === 'all' || user.role === roleFilter) &&
      (user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)),
  )

  // The numbers in the four boxes at the top
  const assigned = desks.filter((desk) => desk.user_id !== null).length

  return (
    <>
      <PageHeader title="Users" description="Create accounts, set roles and assign desks." />

      {unavailable ? (
        <p className="card p-5 text-sm text-neutral-600">User management is not available yet.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Users" value={loading ? '—' : users.length} />
            <StatTile label="Desks" value={loading ? '—' : desks.length} />
            <StatTile label="Assigned desks" value={loading ? '—' : assigned} />
            <StatTile label="Free desks" value={loading ? '—' : desks.length - assigned} />
          </div>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">All users</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  className="input w-52"
                  placeholder="Search name or email…"
                  aria-label="Search name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="input w-auto"
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
                >
                  <option value="all">Role: All</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
                  + New user
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-lg bg-neutral-100 p-3 text-sm">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-sm text-neutral-500">Loading users…</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-neutral-500">{users.length === 0 ? 'No users yet.' : 'No users match your search.'}</p>
            ) : (
              // On a phone the table is wider than the screen, so it scrolls sideways inside the card
              <div className="overflow-x-auto">
                <table className="w-full min-w-175 text-left text-sm">
                  <thead>
                    <tr className="section-title bg-neutral-100">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Assigned desk</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((user) => (
                      <tr key={user.user_id} className="border-b border-neutral-200 last:border-b-0">
                        <td className="px-3 py-3">{user.name}</td>
                        <td className="px-3 py-3 text-neutral-600">{user.email}</td>
                        <td className="px-3 py-3">
                          <select
                            className="input w-auto"
                            aria-label={`Role of ${user.name}`}
                            value={user.role}
                            onChange={(e) => {
                              const role = e.target.value as Role
                              // Leaving the office worker role frees the desk
                              change(() => updateUser(user.user_id, { role, desk_id: hasDesk(role) ? user.desk_id : null }))
                            }}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          {hasDesk(user.role) ? (
                            <select
                              className="input w-auto"
                              aria-label={`Desk of ${user.name}`}
                              value={user.desk_id ?? ''}
                              onChange={(e) => change(() => updateUser(user.user_id, { desk_id: e.target.value || null }))}
                            >
                              <option value="">Not assigned</option>
                              {deskChoices(desks, user).map((desk) => (
                                <option key={desk.desk_id} value={desk.desk_id}>
                                  {deskLabel(desk)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button type="button" className="btn" onClick={() => setEditing(user)}>
                              Edit
                            </button>
                            <button type="button" className="btn" onClick={() => setDeleting(user)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {editing && (
        <UserDialog
          // key makes the form start fresh every time it opens
          key={editing === 'new' ? 'new' : editing.user_id}
          user={editing === 'new' ? undefined : editing}
          desks={desks}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {deleting && (
        <Dialog title="Delete user?" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-neutral-600">
            {deleting.name} ({deleting.email}) will lose access and their desk will be free again. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const user = deleting
                setDeleting(null)
                change(() => deleteUser(user.user_id))
              }}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-600">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

// A box in the middle of the screen on top of a dark background (the "New user" and "Delete" windows).
// Press Escape or click the dark background to close it.
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// The form for a new user. When `user` is given it is the Edit form instead:
// the backend can only change the role and the desk, so name and email are locked.
function UserDialog({ user, desks, onClose, onSaved }: { user?: UserWithDesk; desks: DbDesk[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'worker')
  const [deskId, setDeskId] = useState(user?.desk_id ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const desk_id = hasDesk(role) && deskId ? deskId : undefined
    try {
      if (user) await updateUser(user.user_id, { role, desk_id: desk_id ?? null })
      else await createUser({ name: name.trim(), email: email.trim(), role, desk_id })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.') // like "Email already exists"
      setSaving(false)
    }
  }

  return (
    <Dialog title={user ? 'Edit user' : 'New user'} onClose={onClose}>
      {!user && <p className="mb-4 text-sm text-neutral-600">The user gets an email to set their password.</p>}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="user-name">Full name</label>
          <input id="user-name" className="input" required disabled={!!user} placeholder="e.g. Anna Jensen" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="user-email">Work email</label>
          <input id="user-email" type="email" className="input" required disabled={!!user} placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="user-role">Role</label>
          <select id="user-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {hasDesk(role) && (
          <div>
            <label className="label" htmlFor="user-desk">Assigned desk</label>
            <select id="user-desk" className="input" value={deskId} onChange={(e) => setDeskId(e.target.value)}>
              <option value="">Not assigned</option>
              {deskChoices(desks, user).map((desk) => (
                <option key={desk.desk_id} value={desk.desk_id}>
                  {deskLabel(desk)}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-neutral-100 p-3 text-sm">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {user ? 'Save' : 'Create user'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
