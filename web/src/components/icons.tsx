import type { ReactNode } from 'react'

// The icons for the menu. They're drawn right here as SVG, so we don't need an icon package.
// They use the text colour (currentColor), so they turn grey/black and light/dark together with the text.

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// Four boxes, like the tiles on the dashboard
export function DashboardIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  )
}

// A clock
export function PresetsRoutinesIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  )
}

// Two people
export function UsersIcon() {
  return (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14.5c1.8.8 3 2.7 3 5.5" />
    </Icon>
  )
}

// A desk with a monitor on it
export function DesksIcon() {
  return (
    <Icon>
      <rect x="7" y="3" width="10" height="6" rx="1" />
      <path d="M12 9v3" />
      <path d="M3 12h18" />
      <path d="M5 12v9M19 12v9" />
    </Icon>
  )
}

// Three sliders
export function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Icon>
  )
}
