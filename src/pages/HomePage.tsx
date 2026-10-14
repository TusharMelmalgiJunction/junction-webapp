import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Product } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import { asProductList, initials } from '../lib/format'

function Rail({ title, subtitle, products }: { title: string; subtitle?: string; products: Product[] }) {
  if (products.length === 0) return null
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <Link to="/search">View all</Link>
      </div>
      <div className="grid-4">
        {products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const [fresh, setFresh] = useState<Product[]>([])
  const [opened, setOpened] = useState<Product[]>([])
  const [recommended, setRecommended] = useState<Product[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const trending = await api<unknown>('/api/history/most-clicked', { auth: false }).catch(() => [])
      if (!cancelled) setFresh(asProductList(trending))
      if (!user) return
      const [recent, suggestions, catalog] = await Promise.all([
        api<unknown>('/api/history/last-opened').catch(() => []),
        api<unknown>('/user/recommendations/previous-search-products', { query: { limit: 8, maxQueries: 6, days: 7, nonAuction: true } }).catch(() => []),
        api<unknown>('/product/products/public', { query: { limit: 20 } }).catch((err: Error) => {
          if (!cancelled) setError(err.message)
          return []
        }),
      ])
      if (cancelled) return
      setOpened(asProductList(recent))
      setRecommended(asProductList(suggestions))
      const catalogProducts = asProductList(catalog).filter((product) => !product.status || product.status === 'For Sale')
      if (catalogProducts.length) setFresh(catalogProducts)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  return (
    <AppShell showCategories>
      <main className="page">
        <div className="stack">
          {error ? <div className="banner">{error}</div> : null}
          {!user ? <div className="banner">Log in with your student account to browse listings, save favourites, and start a chat.</div> : null}
          <Rail title="Pick up where you left off" products={opened} />
          <Rail title="Fresh listings" subtitle="Just posted by students near you" products={fresh} />
          <Rail title="Based on your previous search" products={recommended} />
        </div>
        <aside className="aside">
          <section className="panel tint">
            <strong>Got something you don’t use?</strong>
            <p className="muted">List it in a couple of minutes and sell it to a verified student nearby.</p>
            <Link className="btn btn-dark" to="/sell">Post a listing</Link>
          </section>
        </aside>
      </main>
    </AppShell>
  )
}

export function PublicProfilePage() {
  const { userId = '' } = useParams()
  const [profile, setProfile] = useState<{ fullName?: string | null; university?: string | null; selfieUrl?: string | null; avgRating?: number; soldCount?: number } | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Same endpoint the mobile app's other-user profile uses.
        const result = await api<{
          user: { name?: string | null; university?: string | null; profileImage?: string | null }
          avgRating?: number
          productsSoldCount?: number
        }>(`/ratings/others/${userId}`, { auth: false })
        if (!cancelled) {
          setProfile({
            fullName: result.user.name,
            university: result.user.university,
            selfieUrl: result.user.profileImage,
            avgRating: result.avgRating,
            soldCount: result.productsSoldCount,
          })
        }
      } catch {
        if (!cancelled) setMissing(true)
      }
      const listings = await api<unknown>('/product/others/active', { auth: false, query: { userId } }).catch(() => [])
      if (!cancelled) setProducts(asProductList(listings))
    }
    void load()
    return () => { cancelled = true }
  }, [userId])

  return (
    <AppShell>
      <main className="page">
        <div className="stack">
          {missing ? <EmptyState image="nodata.png">This profile is not available.</EmptyState> : (
            <div className="row">
              <span className="avatar" style={{ width: 72, height: 72, borderRadius: 36, fontSize: 22 }}>
                {profile?.selfieUrl ? <img src={profile.selfieUrl} alt="" /> : initials(profile?.fullName)}
              </span>
              <div>
                <h1 style={{ margin: 0 }}>{profile?.fullName || 'Student'}</h1>
                <p className="muted">{profile?.university || 'Verified student'}</p>
                {profile ? (
                  <p className="muted">
                    {profile.avgRating ? `★ ${profile.avgRating.toFixed(1)} · ` : ''}{profile.soldCount || 0} sold
                  </p>
                ) : null}
              </div>
            </div>
          )}
          <h2>Active listings</h2>
          <div className="grid-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {products.length === 0 ? <EmptyState image="nodata.png">No active listings.</EmptyState> : null}
        </div>
      </main>
    </AppShell>
  )
}
