import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import type { Address, AppNotification, Product } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ProductCard } from '../components/ProductCard'
import { markSold } from '../chat/chatService'
import { getFavouriteProducts, loadFavourites, subscribeFavourites } from '../lib/favourites'
import { PLACEHOLDER_IMAGE, asProductList, formatPrice, initials, productImages, productTitle } from '../lib/format'

function SettingsMenu() {
  const links = [
    ['/profile', 'Profile'],
    ['/profile/favourites', 'Favourites'],
    ['/profile/purchases', 'Purchases'],
    ['/profile/sold', 'Sold & earnings'],
    ['/profile/badges', 'Badges'],
    ['/settings/personal', 'Personal info'],
    ['/settings/addresses', 'Addresses'],
    ['/settings/notifications', 'Notifications'],
    ['/settings/referrals', 'Referrals'],
    ['/settings/privacy', 'Privacy'],
    ['/support', 'Support'],
  ]
  return (
    <nav className="menu">
      {links.map(([to, label]) => <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>{label}</NavLink>)}
    </nav>
  )
}

export function ProfilePage() {
  const { user, refreshProfile } = useAuth()
  const [listings, setListings] = useState<Product[]>([])
  useEffect(() => {
    void refreshProfile().catch(() => undefined)
    void api<unknown>('/product/me/active').then((result) => setListings(asProductList(result))).catch(() => setListings([]))
  }, [refreshProfile])

  return (
    <AppShell>
      <main className="page">
        <SettingsMenu />
        <div className="stack">
          <div className="row">
            <span className="avatar" style={{ width: 72, height: 72, borderRadius: 36 }}>{user?.selfieUrl ? <img src={user.selfieUrl} alt="" /> : initials(user?.fullName)}</span>
            <div>
              <h1 style={{ margin: 0 }}>{user?.fullName || 'Your profile'}</h1>
              <p className="muted">{user?.university || user?.email}</p>
            </div>
          </div>
          <h2>My listings</h2>
          <div className="grid-4">{listings.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {listings.length === 0 ? <EmptyState image="nodata.png">You have no active listings. <Link to="/sell">Post one</Link></EmptyState> : null}
        </div>
      </main>
    </AppShell>
  )
}

export function FavouritesPage() {
  const products = useSyncExternalStore(subscribeFavourites, getFavouriteProducts, getFavouriteProducts)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    void loadFavourites(true).then(() => setLoaded(true))
  }, [])
  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Favourites</h1>
          <div className="grid-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {loaded && products.length === 0 ? <EmptyState image="nodata.png">Tap the heart on a listing to save it here.</EmptyState> : null}
        </div>
      </main>
    </AppShell>
  )
}

export function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    void api<unknown>('/product/purchased').then((result) => setProducts(asProductList(result))).catch(() => setProducts([]))
  }, [])
  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Purchases</h1>
          <div className="grid-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {products.length === 0 ? <EmptyState image="nodata.png">No purchases yet.</EmptyState> : null}
        </div>
      </main>
    </AppShell>
  )
}

export function SoldPage() {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    void api<unknown>('/product/sold').then((result) => setProducts(asProductList(result))).catch(() => setProducts([]))
  }, [])
  const earned = products.reduce((sum, product) => sum + Number(product.price || 0), 0)
  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Sold</h1>
          <div className="panel"><strong>{formatPrice(earned)}</strong><span className="muted">Listed prices of sold items</span></div>
          <div className="grid-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {products.length === 0 ? <EmptyState image="productsold.png">Items you sell will show up here.</EmptyState> : null}
        </div>
      </main>
    </AppShell>
  )
}

export function BadgesPage() {
  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Badges</h1>
          <p className="muted">Badges unlock from completed deals and referrals. Names still being finalised in the product copy.</p>
          <div className="grid-4">
            {['First listing', 'Verified student', 'Helpful seller'].map((name) => (
              <div key={name} className="panel"><strong>{name}</strong><span className="muted">Shown when the activity is on your account.</span></div>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  )
}

type ProductChat = { chatId: string; buyerId: string; buyerName?: string; orderId?: string | null; orderStatus?: string | null }

export function SellerListingPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', price: '' })
  const [selling, setSelling] = useState(false)
  const [where, setWhere] = useState<'junction' | 'outside'>('junction')
  const [buyers, setBuyers] = useState<ProductChat[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void api<Product>(`/product/${id}`)
      .then((result) => {
        setProduct(result)
        setForm({ title: productTitle(result), description: result.description || '', price: result.price != null ? String(result.price) : '' })
        setSalePrice(result.price != null ? String(result.price) : '')
      })
      .catch((err: Error) => setError(err.message))
  }, [id])

  const status = product?.status || 'For Sale'
  const locked = status === 'Locked' || status === 'Deal Locked'
  const sold = status === 'Sold'
  const buyer = buyers.find((item) => item.buyerId === buyerId)

  async function run(action: () => Promise<void>, fallback: string) {
    setPending(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setPending(false)
    }
  }

  function openSell() {
    setSelling(true)
    setWhere('junction')
    // Buyers who chatted about this listing, same list the app offers.
    void api<{ chats?: ProductChat[] }>('/chats/product-chats', { query: { productId: id } })
      .then((result) => setBuyers(result.chats || []))
      .catch(() => setBuyers([]))
  }

  function markSoldHere() {
    return run(async () => {
      if (!buyer) throw new Error('Select the buyer')
      let orderId = buyer.orderId || ''
      if (!orderId) {
        const price = Number(salePrice)
        if (!price || price <= 0) throw new Error('Enter the price you sold it for')
        const lockedDeal = await api<{ orderId?: string; order?: { orderId?: string } }>('/product/deal-lock', {
          method: 'POST',
          body: { productId: id, buyerId: buyer.buyerId, finalPrice: price },
        })
        orderId = lockedDeal.orderId || lockedDeal.order?.orderId || ''
        if (!orderId) throw new Error('Could not lock the deal')
      }
      await markSold(orderId)
      navigate(`/my-listings/${id}/sold`, { state: { buyerId: buyer.buyerId } })
    }, 'Could not mark as sold')
  }

  function markSoldOutside() {
    return run(async () => {
      await api('/product/mark-sold', { method: 'POST', body: { productId: id, soldInJunction: false } })
      navigate(`/my-listings/${id}/sold`)
    }, 'Could not mark as sold')
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!product) return
    void run(async () => {
      const price = Number(form.price)
      if (!price || price <= 0) throw new Error('Enter a valid price')
      // PUT replaces the listing, so send every existing field back unchanged.
      const updated = await api<{ product?: Product } & Product>(`/product/products/${id}`, {
        method: 'PUT',
        body: {
          name: form.title,
          title: form.title,
          description: form.description,
          category: product.category,
          subCategory: product.subCategory ?? null,
          condition: product.condition,
          brand: product.brand,
          yearOfPurchase: product.yearOfPurchase,
          usage: product.usage,
          price,
          isAuction: false,
          location: product.location,
          images: product.images,
        },
      })
      setProduct({ ...product, ...(updated.product || {}), title: form.title, description: form.description, price, status: 'Pending' })
      setEditing(false)
    }, 'Could not update the listing')
  }

  function remove() {
    return run(async () => {
      await api(`/product/products/${id}`, { method: 'DELETE' })
      navigate('/profile')
    }, 'Could not delete the listing')
  }

  const images = product ? productImages(product) : []

  return (
    <AppShell>
      <main className="page">
        <div className="stack" style={{ maxWidth: 720 }}>
          {error ? <div className="error">{error}</div> : null}
          {product ? (
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <img src={images[0] || PLACEHOLDER_IMAGE} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12 }} />
              <div className="grow">
                <h1 style={{ margin: 0 }}>{productTitle(product)}</h1>
                <div className="price">{formatPrice(product.price)}</div>
                <p className="muted">Status: {status}{status === 'Pending' ? ' · under review' : ''}</p>
              </div>
            </div>
          ) : !error ? <div className="empty">Loading listing…</div> : null}
          {product && !editing ? <p>{product.description}</p> : null}

          {editing ? (
            <form className="stack panel" onSubmit={save}>
              <strong>Edit listing</strong>
              <label className="lbl">Title<input className="field" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label className="lbl">Description<textarea className="field" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label className="lbl">Price (₹)<input className="field" required inputMode="numeric" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value.replace(/[^\d]/g, '') })} /></label>
              <p className="muted">Edited listings go back to review before they’re live again.</p>
              <div className="row">
                <button className="btn btn-dark" type="submit" disabled={pending}>Save changes</button>
                <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : null}

          {product && !sold && !editing ? (
            <div className="row">
              <button className="btn btn-dark" type="button" onClick={openSell}>Mark as sold</button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(true)}>Edit listing</button>
              <button className="btn btn-ghost" type="button" onClick={() => setDeleting(true)}>Delete listing</button>
            </div>
          ) : null}
          <Link to="/chats">Open chats</Link>
        </div>
      </main>

      {selling ? (
        <Modal title="Mark as sold" onClose={() => setSelling(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>Did you sell the product in Junction or outside?</p>
            <label className="row"><input type="radio" checked={where === 'junction'} onChange={() => setWhere('junction')} /> Junction</label>
            <label className="row"><input type="radio" checked={where === 'outside'} disabled={locked} onChange={() => setWhere('outside')} /> Outside Junction</label>
            {locked ? <p className="muted">Product has a locked deal. Please sell within Junction.</p> : null}
            {where === 'junction' ? (
              buyers.length === 0 ? <p className="muted">No buyers found. Buyers who have started a chat will appear here.</p> : (
                <>
                  <select className="field" value={buyerId} onChange={(event) => setBuyerId(event.target.value)}>
                    <option value="">Select buyer</option>
                    {buyers.map((item) => (
                      <option key={item.chatId} value={item.buyerId}>{item.buyerName || 'Buyer'}{item.orderId ? ' · Deal locked' : ''}</option>
                    ))}
                  </select>
                  {buyer && !buyer.orderId ? (
                    <label className="lbl">Sold for (₹)<input className="field" inputMode="numeric" value={salePrice} onChange={(event) => setSalePrice(event.target.value.replace(/[^\d]/g, ''))} /></label>
                  ) : null}
                </>
              )
            ) : null}
            <button
              className="btn btn-dark"
              type="button"
              disabled={pending || (where === 'junction' && !buyer)}
              onClick={() => void (where === 'junction' ? markSoldHere() : markSoldOutside())}
            >{pending ? 'Saving…' : 'Mark as sold'}</button>
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal title="Delete listing" onClose={() => setDeleting(false)}>
          <p>This removes “{product ? productTitle(product) : 'this listing'}” from Junction. This can’t be undone.</p>
          <button className="btn btn-dark" type="button" disabled={pending} onClick={() => void remove()}>Delete listing</button>
        </Modal>
      ) : null}
    </AppShell>
  )
}

const RATING_QUESTIONS: [key: 'communication' | 'reliability' | 'tradeAgain', question: string, options: string[]][] = [
  ['communication', 'Did they communicate quickly?', ['Yes', 'No', 'Somewhat']],
  ['reliability', 'Did they show up / complete the deal reliably?', ['Yes', 'No']],
  ['tradeAgain', 'Would you trade with them again?', ['Definitely', 'No', 'Maybe']],
]

export function SoldSurveyPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const routeState = useLocation().state as { buyerId?: string } | null
  const [buyerId, setBuyerId] = useState(routeState?.buyerId || '')
  const [stars, setStars] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [vibe, setVibe] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (buyerId) return
    void api<Product>(`/product/${id}`).then((product) => setBuyerId(product.buyerId || '')).catch(() => undefined)
  }, [id, buyerId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!buyerId || !user?.id) return
    if (!stars) {
      setError('Pick a star rating')
      return
    }
    // The ratings API requires a comment (same as the mobile app).
    if (!vibe.trim()) {
      setError('Tell us about the overall vibe')
      return
    }
    setPending(true)
    setError('')
    try {
      // Same payload as the mobile app's rating screen.
      await api('/ratings/', {
        method: 'POST',
        body: {
          ratedUserId: buyerId,
          ratedById: user.id,
          communication: answers.communication || 'N/A',
          reliability: answers.reliability || 'N/A',
          tradeAgain: answers.tradeAgain || 'N/A',
          overallVibe: vibe.trim(),
          comments: vibe.trim(),
          stars,
        },
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the rating')
    } finally {
      setPending(false)
    }
  }

  return (
    <AppShell>
      <main className="page">
        <form className="stack" style={{ maxWidth: 560 }} onSubmit={submit}>
          <img className="illo" src="/assets/productsold.png" alt="" style={{ margin: 0 }} />
          <h1 style={{ margin: 0 }}>Item sold</h1>
          {error ? <div className="error">{error}</div> : null}
          {done ? <div className="success">Thanks for the rating.</div> : buyerId ? (
            <>
              <p className="muted" style={{ margin: 0 }}>How was the buyer?</p>
              <div className="row" role="radiogroup" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="icon-btn"
                    role="radio"
                    aria-checked={stars === value}
                    aria-label={`${value} star${value > 1 ? 's' : ''}`}
                    onClick={() => setStars(value)}
                    style={{ fontSize: 22, color: value <= stars ? '#FF6705' : '#C9C9C9' }}
                  >★</button>
                ))}
              </div>
              {RATING_QUESTIONS.map(([key, question, options], index) => (
                <fieldset key={key} className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
                  <legend style={{ fontWeight: 600, marginBottom: 8 }}>{index + 1}. {question}</legend>
                  <div className="row">
                    {options.map((option) => (
                      <label key={option} className="row" style={{ gap: 6 }}>
                        <input type="radio" name={key} checked={answers[key] === option} onChange={() => setAnswers({ ...answers, [key]: option })} /> {option}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <label className="lbl">4. Overall vibe?
                <textarea className="field" required maxLength={200} value={vibe} onChange={(event) => setVibe(event.target.value)} placeholder="A line about the deal" />
              </label>
              <span className="muted">{vibe.length}/200</span>
              <button className="btn btn-dark" type="submit" disabled={pending}>Submit review</button>
            </>
          ) : <p className="muted">Marked as sold.</p>}
          <Link to="/profile/sold">Back to sold items</Link>
        </form>
      </main>
    </AppShell>
  )
}

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([])
  useEffect(() => {
    void api<{ notifications?: AppNotification[] }>('/api/notifications/user/received')
      .then((result) => setItems(result.notifications || []))
      .catch(() => setItems([]))
  }, [])
  return (
    <AppShell>
      <main className="page">
        <div className="stack" style={{ maxWidth: 720 }}>
          <h1 style={{ margin: 0 }}>Notifications</h1>
          {items.length === 0 ? <EmptyState image="Nonotification.png">You’re all caught up.</EmptyState> : items.map((item) => (
            <article key={item.id} className="notice-card">
              <div>
                <strong>{item.title}</strong>
                <div className="muted">{item.message}</div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  )
}

export function PersonalSettingsPage() {
  const { user, refreshProfile } = useAuth()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>, success: string) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  function upload(file: File) {
    const form = new FormData()
    form.set('profileImage', file)
    return run(async () => {
      await api('/user/update-profile-image', { method: 'PUT', form })
      await refreshProfile()
    }, 'Profile photo updated')
  }

  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Personal info</h1>
          <ProfileLine label="Name" value={user?.fullName} />
          <ProfileLine label="Email" value={user?.email} />
          <ProfileLine label="University" value={user?.university} />
          <ProfileLine label="Phone" value={user?.phoneNumber} />
          <label className="file-row">Profile photo<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} /></label>
          {message ? <div className="success">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <form className="stack" onSubmit={(event) => { event.preventDefault(); void run(() => api('/user/send-phone-otp', { method: 'POST', body: { phoneNumber: phone } }), 'Code sent to your new number') }}>
            <label className="lbl">New phone<input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <button className="btn btn-ghost" type="submit">Send phone code</button>
          </form>
          <form className="row" onSubmit={(event) => { event.preventDefault(); void run(async () => { await api('/user/verify-phone-otp', { method: 'POST', body: { otp } }); await refreshProfile(); setOtp(''); setPhone('') }, 'Phone number updated') }}>
            <input className="field" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Phone code" />
            <button className="btn btn-dark" type="submit">Verify</button>
          </form>
        </div>
      </main>
    </AppShell>
  )
}

function ProfileLine({ label, value }: { label: string; value?: string | null }) {
  return <div className="file-row"><span>{label}</span><strong>{value || '—'}</strong></div>
}

export function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [defaultId, setDefaultId] = useState('')
  const [label, setLabel] = useState('Home')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const result = await api<{ addresses?: Address[]; defaultAddressId?: string }>('/user/get-address')
    setAddresses(result.addresses || [])
    setDefaultId(result.defaultAddressId || '')
  }
  useEffect(() => { void load().catch(() => setAddresses([])) }, [])

  function locate() {
    setError('')
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setError('Allow location access to pin this address.'),
      { timeout: 8000 },
    )
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/user/addnew-address', {
        method: 'POST',
        body: {
          label,
          address,
          setAsDefault: addresses.length === 0,
          latitude: coords?.lat,
          longitude: coords?.lng,
        },
      })
      setAddress('')
      setCoords(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the address')
    } finally {
      setPending(false)
    }
  }

  async function makeDefault(id: string) {
    setError('')
    try {
      await api('/user/set-default-address', { method: 'POST', body: { addressId: id } })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the default address')
    }
  }

  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Addresses</h1>
          {error ? <div className="error">{error}</div> : null}
          {addresses.map((item) => (
            <div key={item.id} className="file-row">
              <div><strong>{item.label}</strong>{item.id === defaultId ? <span className="muted"> · Default</span> : null}<div className="muted">{item.address}</div></div>
              {item.id !== defaultId ? <button className="btn btn-ghost" type="button" onClick={() => void makeDefault(item.id)}>Make default</button> : null}
            </div>
          ))}
          <form className="stack" onSubmit={add}>
            <h2 style={{ margin: 0 }}>Add an address</h2>
            <input className="field" required value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label (Home, Hostel…)" />
            <textarea className="field" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" />
            <div className="row">
              <button className="btn btn-ghost" type="button" onClick={locate}>{coords ? 'Location pinned ✓' : 'Pin my current location'}</button>
              <span className="muted">Pinned addresses can be used as your pickup area.</span>
            </div>
            <button className="btn btn-dark" type="submit" disabled={pending}>Add address</button>
          </form>
        </div>
      </main>
    </AppShell>
  )
}

const NOTIFICATION_PREFS: [string, string, string][] = [
  ['chatNotifications', 'Chat Notifications', 'Messages, replies, and new conversations with buyers or sellers.'],
  ['listingActivity', 'Listing Activity', 'Updates when someone interacts with your listing.'],
  ['biddingAuctions', 'Bidding & Auctions', 'Bids placed, outbids, auction ending reminders, and auction results.'],
  ['offersTransactions', 'Offers & Transactions', 'New offers, accepted deals, purchase confirmations, and payout updates.'],
  ['appUpdates', 'App Updates', 'Feature updates, referral rewards, and important news from Junction.'],
  ['emailAlerts', 'Email Alerts', 'For important updates even when you’re offline.'],
]

export function NotificationPrefsPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  useEffect(() => {
    void api<{ data?: Record<string, boolean> }>('/user/notification-preferences').then((result) => setPrefs(result.data || {})).catch(() => undefined)
  }, [])
  const [error, setError] = useState('')

  // A 404 just means the user hasn't saved preferences yet (all off), as in the app.
  async function toggle(key: string) {
    const previous = prefs
    const next = { ...Object.fromEntries(NOTIFICATION_PREFS.map(([k]) => [k, Boolean(prefs[k])])), [key]: !prefs[key] }
    setPrefs(next)
    setError('')
    try {
      await api('/user/notification-preferences', { method: 'PUT', body: next })
    } catch (err) {
      setPrefs(previous)
      setError(err instanceof Error ? err.message : 'Could not save your preferences')
    }
  }

  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Notification preferences</h1>
          {error ? <div className="error">{error}</div> : null}
          {NOTIFICATION_PREFS.map(([key, title, subtitle]) => (
            <label key={key} className="file-row">
              <span><strong>{title}</strong><div className="muted">{subtitle}</div></span>
              <input type="checkbox" checked={Boolean(prefs[key])} onChange={() => void toggle(key)} />
            </label>
          ))}
        </div>
      </main>
    </AppShell>
  )
}

export function ReferralsPage() {
  const { user } = useAuth()
  const [code, setCode] = useState(user?.referralCode || '')
  const [summary, setSummary] = useState('')
  useEffect(() => {
    void api<{ referral?: { code?: string }; summary?: { totalReferrals?: number; amountEarned?: number } }>('/user/my-referrals')
      .then((result) => {
        if (result.referral?.code) setCode(result.referral.code)
        setSummary(`${result.summary?.totalReferrals || 0} referrals · ₹${result.summary?.amountEarned || 0} earned`)
      })
      .catch(() => undefined)
  }, [])
  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Referrals</h1>
          <img className="illo" src="/assets/noreferrals.png" alt="" style={{ margin: 0 }} />
          <div className="panel">
            <span className="kicker">Your code</span>
            <strong style={{ fontSize: 28 }}>{code || 'Available after onboarding'}</strong>
            <p className="muted">{summary}</p>
            {code ? <button className="btn btn-dark" type="button" onClick={() => void navigator.clipboard.writeText(`https://share.junctionverse.com/referral/${code}`)}>Copy invite link</button> : null}
          </div>
        </div>
      </main>
    </AppShell>
  )
}

const DELETE_REASONS = [
  'I found what I was looking for',
  'I couldn’t find enough product',
  'I had trouble selling my items',
  'I’m concerned about my privacy and data',
  'Not satisfied with the experience',
]

export function PrivacyPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function remove(event: FormEvent) {
    event.preventDefault()
    if (!reason) {
      setError('Pick a reason')
      return
    }
    setError('')
    try {
      // Backend requires a description; the app sends "no description" when empty.
      await api('/user/delete', { method: 'POST', body: { reasonForDeletion: { reason, description: description.trim() || 'no description' } } })
      await logout()
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account')
    }
  }

  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Privacy</h1>
          <button className="btn btn-ghost" type="button" onClick={() => void logout().then(() => navigate('/login'))}>Log out</button>
          <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)}>Delete account</button>
        </div>
      </main>
      {open ? (
        <Modal title="Delete account" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={remove}>
            <img className="illo" src="/assets/accountdelete.png" alt="" style={{ width: 120 }} />
            <p style={{ margin: 0 }}>Help us understand why you’re leaving.</p>
            {error ? <div className="error">{error}</div> : null}
            {DELETE_REASONS.map((item) => (
              <label key={item} className="row"><input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} /> {item}</label>
            ))}
            <textarea className="field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell us a bit more (optional)" />
            <button className="btn btn-dark" type="submit">Delete my account</button>
          </form>
        </Modal>
      ) : null}
    </AppShell>
  )
}

type SupportMessage = { id?: string; content?: string | null; senderType?: string; timestamp?: string }

export function SupportPage() {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [chatId, setChatId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    try {
      // GET /support-chat/my -> { chat: { id, messages[] } }, 404 until the first message.
      const result = await api<{ chat?: { id: string; messages?: SupportMessage[] } }>('/support-chat/my')
      setMessages(result.chat?.messages || [])
      setChatId(result.chat?.id || '')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return
      setError(err instanceof Error ? err.message : 'Could not load support chat')
    }
  }
  useEffect(() => { void load() }, [])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setPending(true)
    setError('')
    try {
      const form = new FormData()
      if (chatId) form.set('chatId', chatId)
      form.set('content', text.trim())
      form.set('type', 'text')
      await api('/support-chat/message', { method: 'POST', form })
      setText('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message')
    } finally {
      setPending(false)
    }
  }

  return (
    <AppShell>
      <main className="page settings-layout">
        <SettingsMenu />
        <div className="stack">
          <h1 style={{ margin: 0 }}>Contact support</h1>
          {error ? <div className="error">{error}</div> : null}
          <div className="panel" style={{ minHeight: 240 }}>
            {messages.length === 0 ? (
              <EmptyState image="SupportTeam.png" title="Need assistance? We’re here to help">Our team’s here for you, shoot your queries!</EmptyState>
            ) : messages.map((message, index) => {
              const fromSupport = message.senderType === 'admin'
              return (
                <div key={message.id || index} className={fromSupport ? 'bubble' : 'bubble mine'}>
                  {message.content}
                </div>
              )
            })}
          </div>
          <form className="row" onSubmit={send}>
            <input className="field grow" value={text} onChange={(event) => setText(event.target.value)} placeholder="Message support" />
            <button className="btn btn-dark" type="submit" disabled={pending}>Send</button>
          </form>
          <Link to="/support/report">Report an issue with screenshots</Link>
        </div>
      </main>
    </AppShell>
  )
}

export function ReportIssuePage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const form = new FormData()
    form.set('issueTitle', title)
    form.set('issueDescription', description)
    if (file) form.append('screenshots', file)
    await api('/user/report-issue', { method: 'POST', form })
    setDone(true)
  }

  return (
    <AppShell>
      <main className="page">
        <form className="stack" style={{ maxWidth: 640 }} onSubmit={submit}>
          <h1>Report an issue</h1>
          {done ? <EmptyState image="ProductManual.png" title="Report submitted">Sent to the Junction team.</EmptyState> : (
            <>
              <input className="field" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
              <textarea className="field" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened?" />
              <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <button className="btn btn-dark" type="submit">Submit</button>
            </>
          )}
        </form>
      </main>
    </AppShell>
  )
}

export function NotFoundPage() {
  return (
    <AppShell>
      <div className="center-state">
        <div>
          <img className="illo" src="/assets/nodata.png" alt="" />
          <h1>Page not found</h1>
          <p className="muted">That screen isn’t part of Junction.</p>
          <Link className="btn btn-dark" to="/">Back home</Link>
        </div>
      </div>
    </AppShell>
  )
}
