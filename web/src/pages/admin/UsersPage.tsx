import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, createUser, deleteUser, getDesks, getUsers, updateUser } from '../../api/users.ts'
import type { DbDesk, UserWithDesk } from '../../api/users.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { ROLES, ROLE_LABELS } from '../../auth.ts'
import type { Role } from '../../auth.ts'

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

function messageOf(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

export function UsersPage() {
  const [users, setUsers] = useState<UserWithDesk[]>([])
  const [desks, setDesks] = useState<DbDesk[]>([])
  const [loading, setLoading] = useState(true) // true until the first load has finished (or failed)
  const [loaded, setLoaded] = useState(false) // true once we have got the lists at least once
  const [unavailable, setUnavailable] = useState(false) // the last load failed because the backend is missing or down
  const [loadError, setLoadError] = useState('') // the last load failed (we keep showing the old lists)
  const [error, setError] = useState('') // a change (new role, delete...) failed
  const [busy, setBusy] = useState<string[]>([]) // the ids of users that have a change on its way
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  // Which dialog is open: 'new' = New user, a user = Edit that user, null = none
  const [editing, setEditing] = useState<UserWithDesk | 'new' | null>(null)
  const [deleting, setDeleting] = useState<UserWithDesk | null>(null)
  // Counts the loads. If an older load finishes after a newer one, we throw its answer away.
  const lastLoad = useRef(0)

  // Loads both lists again. We do this after every change, so the page always shows what the backend has.
  async function load() {
    const id = ++lastLoad.current
    try {
      const [newUsers, newDesks] = await Promise.all([getUsers(), getDesks()])
      if (id !== lastLoad.current) return
      setUsers(newUsers)
      setDesks(newDesks)
      setLoaded(true)
      setUnavailable(false)
      setLoadError('')
    } catch (e) {
      if (id !== lastLoad.current) return
      setUnavailable(e instanceof ApiError && e.unavailable)
      setLoadError(messageOf(e)) // the old lists stay on the screen
    }
    setLoading(false)
  }

  useEffect(() => {
    // Loading the data when the page opens is exactly what an effect is for (the setState calls happen after the await)
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [])

  // Runs a change (like a new role) for one user and then reloads. If it fails, the error stays on the page.
  async function change(userId: string, action: () => Promise<unknown>) {
    setError('')
    setBusy((ids) => [...ids, userId])
    try {
      await action()
    } catch (e) {
      setError(messageOf(e))
    }
    await load()
    setBusy((ids) => ids.filter((id) => id !== userId))
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

      {/* The "not available yet" card is only for when the very first load fails */}
      {!loaded && unavailable ? (
        <p className="card p-5 text-sm text-neutral-600">User management is not available yet.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Users" value={loaded ? users.length : '—'} />
            <StatTile label="Desks" value={loaded ? desks.length : '—'} />
            <StatTile label="Assigned desks" value={loaded ? assigned : '—'} />
            <StatTile label="Free desks" value={loaded ? desks.length - assigned : '—'} />
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
            {loadError && (
              <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-100 p-3 text-sm">
                <span>{loaded ? `Could not refresh the list: ${loadError}` : loadError}</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setError('')
                    setLoadError('')
                    load()
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-neutral-500">Loading users…</p>
            ) : !loaded ? null : shown.length === 0 ? (
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
                    {shown.map((user) => {
                      const pending = busy.includes(user.user_id) // this row is waiting for the backend
                      return (
                        <tr key={user.user_id} className="border-b border-neutral-200 last:border-b-0">
                          <td className="px-3 py-3">{user.name}</td>
                          <td className="px-3 py-3 text-neutral-600">{user.email}</td>
                          <td className="px-3 py-3">
                            <select
                              className="input w-auto"
                              aria-label={`Role of ${user.name}`}
                              disabled={pending}
                              value={user.role}
                              onChange={(e) => {
                                const role = e.target.value as Role
                                // Leaving the office worker role frees the desk
                                change(user.user_id, () => updateUser(user.user_id, { role, desk_id: hasDesk(role) ? user.desk_id : null }))
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
                                disabled={pending}
                                value={user.desk_id ?? ''}
                                onChange={(e) => change(user.user_id, () => updateUser(user.user_id, { desk_id: e.target.value || null }))}
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
                              <button type="button" className="btn" aria-label={`Edit ${user.name}`} disabled={pending} onClick={() => setEditing(user)}>
                                Edit
                              </button>
                              <button type="button" className="btn" aria-label={`Delete ${user.name}`} disabled={pending} onClick={() => setDeleting(user)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
            // Only close the dialog that was saved, not a different one that was opened in the meantime
            const saved = editing
            setEditing((open) => (open === saved ? null : open))
            load()
          }}
        />
      )}

      {deleting && (
        <Dialog title="Delete user?" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-neutral-600">
            {deleting.name} ({deleting.email}) will lose access and their desk will be free again. Their presets, routines and health history are deleted too. This cannot be undone.
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
                change(user.user_id, () => deleteUser(user.user_id))
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

// A window in the middle of the screen on top of a dark background (the "New user" and "Delete" windows).
// It is the browser's own <dialog>, so Escape and keeping the focus inside it just work (we give the focus back ourselves, see below).
// A click on the dark background closes it too. The window itself has no padding (the inner div has),
// so a click that lands on the <dialog> itself can only be a click outside the white box.
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const leaving = useRef(false) // true when we are closing the window on purpose

  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement as HTMLElement | null // the button that opened the window
    leaving.current = false
    dialog?.showModal()
    return () => {
      leaving.current = true
      dialog?.close()
      opener?.focus() // by now React has already removed the window, so the browser can't give the focus back by itself
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="card m-auto w-full max-w-sm text-neutral-900 backdrop:bg-black/40"
      onCancel={(e) => {
        e.preventDefault() // we close it ourselves, so onClose can say no (for example while saving)
        onClose()
      }}
      // Chrome only lets us block Escape once per key press, so a second quick Escape can still close the window.
      // If that happens while the page still wants it open (for example while saving), we open it again.
      onClose={(e) => {
        if (!leaving.current && !e.currentTarget.open) e.currentTarget.showModal()
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="p-6">
        <h2 id={titleId} className="mb-2 text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
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
    // "required" lets a name with only spaces through, so we check the trimmed name ourselves.
    // (When editing, the name is locked, so we leave it alone.)
    if (!user && !name.trim()) {
      setError('Please enter a full name.')
      return
    }
    setSaving(true)
    setError('')
    const desk_id = hasDesk(role) && deskId ? deskId : undefined
    try {
      if (user) await updateUser(user.user_id, { role, desk_id: desk_id ?? null })
      else await createUser({ name: name.trim(), email: email.trim(), role, desk_id })
      onSaved()
    } catch (err) {
      setError(messageOf(err)) // like "A user with this email already exists."
      setSaving(false)
    }
  }

  // While saving, nothing can close the window (Cancel, Escape and the background all do nothing)
  function close() {
    if (!saving) onClose()
  }

  return (
    <Dialog title={user ? 'Edit user' : 'New user'} onClose={close}>
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
          <button type="button" className="btn" onClick={close}>
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
