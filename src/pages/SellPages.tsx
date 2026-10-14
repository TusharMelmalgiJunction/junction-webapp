import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { AppShell } from '../components/AppShell'
import { CATEGORIES, CONDITIONS, USAGES, categoryIcon } from '../lib/format'
import { getLocation } from '../lib/location'

type Draft = {
  category: string
  subCategory: string
  title: string
  description: string
  condition: string
  brand: string
  yearOfPurchase: string
  usage: string
  price: string
}

const KEY = 'junction.listing'
const MAX_PHOTOS = 6 // same limit as the mobile app
let photos: File[] = []

function readDraft(): Draft {
  const fallback: Draft = {
    category: '',
    subCategory: '',
    title: '',
    description: '',
    condition: 'Gently Used',
    brand: '',
    yearOfPurchase: String(new Date().getFullYear()),
    usage: 'Normal Usage',
    price: '',
  }
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? { ...fallback, ...JSON.parse(raw) as Draft } : fallback
  } catch {
    return fallback
  }
}

function saveDraft(draft: Draft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft))
}

export function setListingPhotos(files: File[]) {
  photos = files
}

export function getListingPhotos() {
  return photos
}

export function PostCategoryPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(readDraft())
  const selected = CATEGORIES.find((item) => item.value === draft.category)
  return (
    <AppShell>
      <main className="page">
        <div className="stack" style={{ maxWidth: 720 }}>
          <div className="stepper"><i className="on" /><i /><i /></div>
          <h1 style={{ margin: 0 }}>What are you selling?</h1>
          <div className="grid-4">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                className="panel cat-tile"
                type="button"
                style={draft.category === category.value ? { borderColor: '#3F2B81' } : undefined}
                onClick={() => {
                  const next = { ...draft, category: category.value, subCategory: '' }
                  saveDraft(next)
                  setDraft(next)
                }}
              >
                <img src={categoryIcon(category.value)} alt="" />
                <strong>{category.label}</strong>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="stack">
              <h2>Subcategory</h2>
              {selected.subs.map((sub) => (
                <button key={sub} className="btn btn-ghost" type="button" onClick={() => { saveDraft({ ...draft, category: selected.value, subCategory: sub }); navigate('/sell/details') }}>{sub}</button>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  )
}

export function PostDetailsPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(readDraft())
  const [error, setError] = useState('')
  const [photoCount, setPhotoCount] = useState(photos.length)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.category) {
      setError('Choose a category first.')
      return
    }
    if (!Number(draft.price) || Number(draft.price) <= 0) {
      setError('Enter a valid price.')
      return
    }
    if (photos.length === 0) {
      setError('Add at least one photo.')
      return
    }
    saveDraft(draft)
    navigate('/sell/review')
  }

  return (
    <AppShell>
      <main className="page">
        <form className="stack" style={{ maxWidth: 720 }} onSubmit={submit}>
          <div className="stepper"><i className="on" /><i className="on" /><i /></div>
          <h1 style={{ margin: 0 }}>Describe your listing</h1>
          {error ? <div className="error">{error}</div> : null}
          <label className="lbl">Title<input className="field" required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="lbl">Description<textarea className="field" required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="lbl">Brand<input className="field" required value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} /></label>
          <div className="row">
            <label className="lbl grow">Condition
              <select className="field" value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value })}>
                {CONDITIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="lbl grow">Usage
              <select className="field" value={draft.usage} onChange={(event) => setDraft({ ...draft, usage: event.target.value })}>
                {USAGES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <label className="lbl grow">Year of purchase<input className="field" required value={draft.yearOfPurchase} onChange={(event) => setDraft({ ...draft, yearOfPurchase: event.target.value })} /></label>
            <label className="lbl grow">Price (₹)<input className="field" required inputMode="numeric" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value.replace(/[^\d]/g, '') })} /></label>
          </div>
          <label className="lbl">Photos
            <input className="field" type="file" accept="image/*" multiple onChange={(event) => {
              const files = Array.from(event.target.files || [])
              setListingPhotos(files.slice(0, MAX_PHOTOS))
              setPhotoCount(Math.min(files.length, MAX_PHOTOS))
              setError(files.length > MAX_PHOTOS ? `Only the first ${MAX_PHOTOS} photos will be used.` : '')
            }} />
          </label>
          <span className="muted">{photoCount}/{MAX_PHOTOS} photos</span>
          <p className="muted">Pickup area: {getLocation().label}. Change it from the header.</p>
          <button className="btn btn-dark" type="submit">Review listing</button>
        </form>
      </main>
    </AppShell>
  )
}

export function ReviewListingPage() {
  const navigate = useNavigate()
  const draft = readDraft()
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const location = getLocation()

  async function submit() {
    if (photos.length === 0) {
      setError('Add at least one photo.')
      return
    }
    setPending(true)
    setError('')
    try {
      const form = new FormData()
      form.set('name', draft.title)
      form.set('title', draft.title)
      form.set('description', draft.description)
      form.set('category', draft.category)
      form.set('subCategory', draft.subCategory)
      form.set('condition', draft.condition)
      form.set('brand', draft.brand)
      form.set('yearOfPurchase', draft.yearOfPurchase)
      form.set('usage', draft.usage)
      form.set('price', draft.price)
      form.set('isAuction', 'false')
      form.set('location', JSON.stringify({ lat: location.lat, lng: location.lng }))
      photos.forEach((file) => form.append('images', file))
      const created = await api<{ id?: string; product?: { id: string } }>('/product/products', { method: 'POST', form })
      sessionStorage.removeItem(KEY)
      photos = []
      navigate('/sell/submitted', { state: { id: created.product?.id || created.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the listing')
    } finally {
      setPending(false)
    }
  }

  return (
    <AppShell>
      <main className="page">
        <div className="stack" style={{ maxWidth: 720 }}>
          <div className="stepper"><i className="on" /><i className="on" /><i className="on" /></div>
          <h1 style={{ margin: 0 }}>Review</h1>
          <div className="panel">
            <strong>{draft.title || 'Untitled'}</strong>
            <span>{draft.category}{draft.subCategory ? ` · ${draft.subCategory}` : ''}</span>
            <span className="price">₹{draft.price}</span>
            <p>{draft.description}</p>
            <span className="muted">{photos.length} photo{photos.length === 1 ? '' : 's'} · {location.label}</span>
          </div>
          <div className="panel">
            <img src="/assets/ProductManual.png" alt="" style={{ width: 72 }} />
            <strong>Listing guidelines</strong>
            <p className="muted">One item per listing, real photos, and an honest condition. Prohibited items are removed.</p>
            <label className="row"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I followed the guidelines</label>
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn btn-dark" type="button" disabled={!agreed || pending} onClick={() => void submit()}>{pending ? 'Posting…' : 'Post listing'}</button>
        </div>
      </main>
    </AppShell>
  )
}

export function SubmittedPage() {
  const navigate = useNavigate()
  return (
    <AppShell>
      <div className="center-state">
        <div>
          <img className="illo" src="/assets/SubmitListingSuccess.png" alt="" />
          <h1>Your listing has been submitted</h1>
          <p className="muted">We’re reviewing your item to ensure it meets our guidelines. You’ll be notified as soon as it’s live.</p>
          <button className="btn btn-dark" type="button" onClick={() => navigate('/profile')}>Return to Profile</button>
        </div>
      </div>
    </AppShell>
  )
}
