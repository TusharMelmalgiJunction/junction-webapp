import type { ReactNode } from 'react'

// Illustrated empty/success state, using the same artwork as the mobile app.
export function EmptyState({ image, title, children }: { image: string; title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <img className="illo" src={`/assets/${image}`} alt="" />
      {title ? <h2>{title}</h2> : null}
      {children}
    </div>
  )
}
