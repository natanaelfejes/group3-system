import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.tsx'
import { Section } from '../components/Section.tsx'
import { loadTheme, setTheme, THEMES, type Theme } from '../theme.ts'

// Everyone sees this page
export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account and preferences." />
      <div className="grid max-w-xl gap-4">
        <AppearanceSettings />
      </div>
    </>
  )
}

function AppearanceSettings() {
  const [theme, setThemeState] = useState<Theme>(loadTheme)

  function choose(newTheme: Theme) {
    setTheme(newTheme)
    setThemeState(newTheme)
  }

  return (
    <Section title="Appearance">
      <p className="mb-3 text-sm text-neutral-600">
        Theme. "System" follows your device's light or dark setting.
      </p>
      <div className="inline-flex rounded-lg border border-neutral-300 p-1">
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={theme === value}
            className={`rounded-md px-4 py-1.5 text-sm ${
              theme === value ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </Section>
  )
}
