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
      <div className=" flex min-h-9 items-center justify-between ">
        <h2 className="w-1/4 section-title">{title}</h2>
        <div className="w-1/3">
          {action}
        </div>
      </div>
      {children}
    </section>
  )
}
