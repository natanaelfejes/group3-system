import type { ReactNode } from 'react'

// A white box with a small title in capitals, like "DESK CONTROL".
// If you give it an action (like a button), it shows up on the right of the title.
export function Section({
  title,
  action,
  className = '',
  children,
}: {
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-4 flex min-h-9 items-center justify-between gap-4">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
