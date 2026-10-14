import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Address } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CATEGORIES, categoryIcon } from '../lib/format'
import { detectBrowserLocation, getLocation, setLocation, subscribeLocation } from '../lib/location'
import { initials } from '../lib/format'
import { Icon, icons } from './Icon'
import { Logo } from './Logo'

// "Road No. 92, Film Nagar, Hyderabad, Telangana 500096, India" -> "Film Nagar, Hyderabad"
function shortAddress(address?: string) {
  const parts = (address || '').split(',').map((part) => part.trim()).filter((part) => part && !/^\d/.test(part) && !/\d{5,}/.test(part))
  const local = parts.length > 2 ? parts.slice(0, -1) : parts // drop the country
  return local.slice(-2).join(', ')
}

export function AppShell({ children, showCategories = false }: { children: ReactNode; showCategories?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useSyncExternalStore(subscribeLocation, getLocation, getLocation)
  const [query, setQuery] = useState('')
  const [editingLocation, setEditingLocation] = useState(false)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [locating, setLocating] = useState(false)

  // Saved addresses are the pickup/search areas, as in the app's location picker.
  useEffect(() => {
    if (!editingLocation || !user?.isOnboarded) return
    void api<{ addresses?: Address[] }>('/user/get-address')
      .then((result) => setAddresses(result.addresses || []))
      .catch(() => setAddresses([]))
  }, [editingLocation, user?.isOnboarded])

  function pickAddress(item: Address) {
    if (typeof item.latitude !== 'number' && typeof item.lat !== 'number') return
    setLocation({
      label: shortAddress(item.address) || item.label || 'Saved address',
      lat: (item.lat ?? item.latitude) as number,
      lng: (item.lng ?? item.longitude) as number,
    })
    setEditingLocation(false)
  }

  function search(event: FormEvent) {
    event.preventDefault()
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <>
      <header className="app-header">
        <Logo />
        <button className="location-btn" type="button" onClick={() => setEditingLocation(true)}>
          <Icon paths={icons.pin} />
          <span className="loc-label">{location.label}</span>
          <Icon paths={icons.chevron} size={16} />
        </button>
        <form className="search-bar" onSubmit={search}>
          <Icon paths={icons.search} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for books, phones, cycles" aria-label="Search listings" />
        </form>
        <nav className="row" aria-label="Account">
          <Link className="icon-btn" to="/chats" aria-label="Chats"><Icon paths={icons.chat} size={22} /></Link>
          <Link className="icon-btn" to="/notifications" aria-label="Notifications"><Icon paths={icons.bell} size={22} /></Link>
        </nav>
        <Link className="btn btn-dark" to="/sell"><Icon paths={icons.plus} />Post a listing</Link>
        {user ? (
          <Link className="avatar" to="/profile" aria-label="Your profile">{user.selfieUrl ? <img src={user.selfieUrl} alt="" /> : initials(user.fullName || user.email)}</Link>
        ) : (
          <Link className="btn btn-ghost" to="/login">Log in</Link>
        )}
      </header>
      {showCategories ? (
        <div className="cat-row">
          {CATEGORIES.map((category) => (
            <Link key={category.value} className="chip" to={`/search?category=${encodeURIComponent(category.value)}`}><img className="cat-icon" src={categoryIcon(category.value)} alt="" />{category.label}</Link>
          ))}
        </div>
      ) : null}
      {editingLocation ? (
        <div className="modal-back" onClick={() => setEditingLocation(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2 style={{ margin: 0 }}>Pickup area</h2>
            <p className="muted">Search and new listings use this area.</p>
            {addresses.map((item) => (
              <button key={item.id} className="file-row" type="button" onClick={() => pickAddress(item)} style={{ textAlign: 'left' }}>
                <span><strong>{item.label || 'Address'}</strong><div className="muted">{item.address}</div></span>
              </button>
            ))}
            {user?.isOnboarded ? <Link to="/settings/addresses" onClick={() => setEditingLocation(false)}>Manage saved addresses</Link> : null}
            <button
              className="btn btn-dark"
              type="button"
              disabled={locating}
              onClick={() => {
                setLocating(true)
                void detectBrowserLocation().then(() => {
                  setLocating(false)
                  setEditingLocation(false)
                })
              }}
            >{locating ? 'Locating…' : 'Use my current location'}</button>
          </div>
        </div>
      ) : null}
      {children}
    </>
  )
}
