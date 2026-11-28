import type { ComponentType } from 'react'
import type { Role, User } from './auth.ts'
import { DashboardIcon, DesksIcon, PresetsRoutinesIcon, SettingsIcon, UsersIcon } from './components/icons.tsx'
import { AdminDesksPage } from './pages/admin/AdminDesksPage.tsx'
import { UsersPage } from './pages/admin/UsersPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { MaintenanceDesksPage } from './pages/maintenance/MaintenanceDesksPage.tsx'
import { PresetsRoutinesPage } from './pages/PresetsRoutinesPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import {MaintenanceDeskPage} from "./pages/maintenance/MaintenanceDeskPage.tsx";

// Every page gets the logged-in user, so it knows whose data to load
export type PageProps = { user: User }
type PageComponent = any

// The list of all pages. The menu is made from this list (in this order),
// and it also decides which role can open which page.
type PageConfig = {
  path: string
  label: string
  // The icon next to the name in the menu (they're in components/icons.tsx)
  icon: ComponentType
  // Which page each role gets. If a role isn't in here, it doesn't see the page in the menu and can't open it.
  views: Partial<Record<Role, PageComponent>>
  // Is it rendered on the navigation bar or not
  isTopLevel: boolean
  isIndex: boolean
}

// For pages that are the same for everyone, like the dashboard. Everyone gets the same page, just with their own data.
function forAllRoles(component: PageComponent): Record<Role, PageComponent> {
  return { admin: component, worker: component, maintenance_worker: component }
}

const PAGES: PageConfig[] = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon, views: forAllRoles(DashboardPage), isTopLevel: true, isIndex: true },
  { path: '/presets', label: 'Presets & routines', icon: PresetsRoutinesIcon, views: forAllRoles(PresetsRoutinesPage), isTopLevel: true, isIndex: false },
  { path: '/users', label: 'Users', icon: UsersIcon, views: { admin: UsersPage }, isTopLevel: true, isIndex: false },
  { path: '/desks', label: 'Desks', icon: DesksIcon, views: { admin: AdminDesksPage, maintenance_worker: MaintenanceDesksPage }, isTopLevel: true, isIndex: false},
  { path: '/desk/:id', label: 'Desk', icon: DesksIcon, views: { maintenance_worker: MaintenanceDeskPage}, isTopLevel: false, isIndex: false},
  { path: '/settings', label: 'Settings', icon: SettingsIcon, views: forAllRoles(SettingsPage), isTopLevel: true, isIndex: false},
]

export type Page = { path: string; label: string; icon: ComponentType; Component: PageComponent, isTopLevel: boolean, isIndex: boolean}

// Gives back only the pages this role is allowed to see
export function pagesFor(role: Role): Page[] {
  return PAGES.flatMap(({ path, label, icon, views, isTopLevel, isIndex }) => {
    const Component = views[role]
    return Component ? [{ path, label, icon, Component, isTopLevel, isIndex }] : []
  })
}
