import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Product } from '../api/types'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import { CATEGORIES, CONDITIONS, asProductList } from '../lib/format'
import { getLocation } from '../lib/location'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const category = params.get('category') || ''
  const condition = params.get('condition') || ''
  const minPrice = params.get('minPrice') || ''
  const maxPrice = params.get('maxPrice') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const location = getLocation()
    let cancelled = false
    setLoading(true)
    api<unknown>('/user/search/current', {
      query: {
        query,
        category: category || undefined,
        condition: condition || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        userLat: location.lat,
        userLng: location.lng,
        sortBy: 'Distance',
        limit: 40,
        listingType: 'sale',
      },
    })
      .then((result) => {
        if (!cancelled) setProducts(asProductList(result).filter((product) => product.isAuction !== true))
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    if (query) {
      void api('/user/search-history', { method: 'POST', body: { query } }).catch(() => undefined)
    }
    return () => { cancelled = true }
  }, [query, category, condition, minPrice, maxPrice])

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  return (
    <AppShell>
      <main className="page">
        <aside className="filters">
          <h2 style={{ margin: 0 }}>Filters</h2>
          <label className="lbl">Category
            <select className="select field" value={category} onChange={(event) => update('category', event.target.value)}>
              <option value="">All</option>
              {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="lbl">Condition
            <select className="select field" value={condition} onChange={(event) => update('condition', event.target.value)}>
              <option value="">Any</option>
              {CONDITIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="lbl">Min price<input className="field" value={minPrice} onChange={(event) => update('minPrice', event.target.value)} inputMode="numeric" /></label>
          <label className="lbl">Max price<input className="field" value={maxPrice} onChange={(event) => update('maxPrice', event.target.value)} inputMode="numeric" /></label>
        </aside>
        <div className="stack">
          <h1 style={{ margin: 0 }}>{query ? `Results for “${query}”` : category || 'Listings near you'}</h1>
          {error ? <div className="error">{error}</div> : null}
          {loading ? <div className="empty">Searching…</div> : null}
          {!loading && products.length === 0 ? <EmptyState image="nodata.png">No listings match these filters. Try a wider area or another category.</EmptyState> : null}
          <div className="grid-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        </div>
      </main>
    </AppShell>
  )
}
