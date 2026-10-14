import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="center-state">Loading Junction…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="auth-split">
      <section className="auth-hero">
        <Logo large />
        <div>
          <h1>Browse. Sell.<br />Only with verified students.</h1>
          <div className="auth-points" style={{ marginTop: 28 }}>
            <article>
              <img className="slide" src="/assets/slide1.png" alt="" />
              <div><strong>A marketplace built for students</strong><div className="muted">Buy and sell within Junction’s verified student community.</div></div>
            </article>
            <article>
              <img className="slide" src="/assets/slide2.png" alt="" />
              <div><strong>List and sell your items</strong><div className="muted">Post a listing in a couple of minutes and reach buyers on campus.</div></div>
            </article>
            <article>
              <img className="slide" src="/assets/slide3.png" alt="" />
              <div><strong>A marketplace you can trust</strong><div className="muted">Every account is verified with a student email or documents.</div></div>
            </article>
          </div>
        </div>
        <div className="muted">Auctions stay in the mobile app for now.</div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
