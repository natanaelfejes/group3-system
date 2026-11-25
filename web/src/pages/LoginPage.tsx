import { ROLES, ROLE_LABELS, type Role } from '../auth.ts'

// The email form is a stub until Supabase Auth (see auth.ts). The role buttons are the way in.
export function LoginPage({ onLogin }: { onLogin: (role: Role) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold tracking-tight">HEIGHTHUB</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-600">Sign in to control your desk</p>

        <form className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="label">
              Work email
            </label>
            <input id="email" type="email" autoComplete="username" placeholder="name@company.com" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input id="password" type="password" autoComplete="current-password" className="input" />
          </div>
          <button type="submit" disabled className="btn-primary w-full py-2.5">
            Log in
          </button>
          <p className="text-sm text-neutral-600">Email login is not connected yet. Use a shortcut below.</p>
        </form>

        <p className="mt-4 text-sm text-neutral-600">Forgot your password? Ask your office admin.</p>

        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="mb-2 text-xs text-neutral-600">Prototype shortcut – sign in as:</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((role) => (
              <button key={role} type="button" onClick={() => onLogin(role)} className="btn">
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
