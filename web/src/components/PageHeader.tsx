import type { ReactNode } from 'react'

// The big title and the small text under it at the top of each page.
// Anything you put inside it shows up on the right.
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      </div>
      {children}
    </div>
  )
}
