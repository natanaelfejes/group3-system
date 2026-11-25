import type { ReactNode } from 'react'
import { ROLE_LABELS, type User } from '../auth.ts'
import type { Page } from '../navigation.ts'
import {NavLink} from "react-router";

type LayoutProps = {
  user: User
  pages: Page[]
  currentPath: string
  onLogout: () => void
  children: ReactNode
}

// The header and the menu that are around every page once you're logged in.
// On a computer the menu is on the left, on a phone it moves to the bottom of the screen.
export function Layout({ user, pages, currentPath, onLogout, children }: LayoutProps) {

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">HEIGHTHUB</span>
          <span className="hidden rounded-full border border-neutral-900 px-2.5 py-0.5 text-xs sm:inline">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden sm:inline">Hi, {user.name}</span>
          <button type="button" onClick={onLogout} className="underline underline-offset-2 hover:text-neutral-600">
            Log out
          </button>
        </div>
      </header>

      {/* Extra space at the bottom on phones, so the bottom menu doesn't cover the page */}
      <div className="h-full flex flex-1 gap-4 p-4 pb-20 md:pb-4">
        <nav className="card hidden w-48 shrink-0 p-2 md:block">
          {pages.map((page) => {
              if(page.isTopLevel) {
                  return (<NavLink to={page.path} key={page.path}
                                   className={({ isActive, isPending }) =>
                                       isPending ? "nav-link pending" : isActive ? "nav-link nav-link-active" : "nav-link"
                                   }>
                      <page.icon/>
                      {page.label}
                  </NavLink>);
              }
              }
          )}
        </nav>
        <main className="h-full min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white md:hidden">
          {pages.map((page) => {
                  if(page.isTopLevel) {
                      return (<NavLink to={page.path} key={page.path}
                                       className={page.path === currentPath ? 'nav-link nav-link-active' : 'nav-link'}>
                          <page.icon/>
                          {page.label}
                      </NavLink>);
                  }
              }
          )}
      </nav>
    </div>
  )
}
