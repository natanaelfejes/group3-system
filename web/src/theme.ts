// Light and dark mode. The choice is saved in the browser, so it stays after a refresh.
// Dark mode works by adding the class "dark" to the page, and then index.css switches the colours.

export type Theme = 'system' | 'light' | 'dark'

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const STORAGE_KEY = 'heighthub.theme'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

export function loadTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemDark.matches)
  document.documentElement.classList.toggle('dark', dark)
}

// Runs once when the app starts. If the user picked "System", it also switches by itself
// when the computer changes between light and dark.
export function initTheme() {
  applyTheme(loadTheme())
  systemDark.addEventListener('change', () => applyTheme(loadTheme()))
}
