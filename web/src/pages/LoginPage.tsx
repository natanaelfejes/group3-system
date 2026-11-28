import { ROLES, ROLE_LABELS, type Role } from '../auth.ts'

// The Google button is a stub until the Google login is set up (see auth.ts). The role buttons are the way in.
export function LoginPage({ onLogin }: { onLogin: (role: Role) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold tracking-tight">HEIGHTHUB</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-600">Sign in to control your desk</p>

        <button type="button" disabled className="btn-primary w-full py-2.5">
          Log in with Google
        </button>
        <p className="mt-2 text-sm text-neutral-600">Google login is not connected yet. Use a shortcut below.</p>

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
