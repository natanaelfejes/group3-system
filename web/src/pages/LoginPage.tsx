import { ROLES, ROLE_LABELS, type Role } from '../auth.ts'

// swap these role buttons for a normal login with the google auth
export function LoginPage({ onLogin }: { onLogin: (role: Role) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-center text-2xl font-bold tracking-tight">HEIGHTHUB</h1>
        <p className="mt-1 mb-6 text-center text-sm text-neutral-600">Choose a role to log in</p>
        <div className="flex flex-col gap-3">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onLogin(role)}
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
