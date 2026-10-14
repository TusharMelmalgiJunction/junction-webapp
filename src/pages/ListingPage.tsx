import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Product } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/AppShell'
import { ImageViewer } from '../components/ImageViewer'
import { ProductCard } from '../components/ProductCard'
import { openProductChat } from '../chat/chatService'
import { PLACEHOLDER_IMAGE, formatPrice, placeLabel, productImages, productTitle, timeAgo } from '../lib/format'

// Same reasons as the mobile app / backend LISTING_REPORT_REASON_CODES.
const REPORT_REASONS = [
  ['SCAM', 'Scam / Fraud'],
  ['SPAM', 'Spam or promotion'],
  ['INAPPROPRIATE', 'Inappropriate content'],
  ['MISLEADING', 'Misleading information'],
  ['OTHER', 'Other'],
]

export function ListingPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [photo, setPhoto] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [reported, setReported] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<Product>(`/product/${id}`)
      .then((result) => {
        if (cancelled) return
        setProduct(result)
        void api('/product/track-click', { method: 'POST', body: { productId: id } }).catch(() => undefined)
        void api('/api/history/track-click', { method: 'POST', body: { productId: id } }).catch(() => undefined)
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message) })
    api<{ relatedProducts?: Product[] }>(`/product/related/${id}`)
      .then((result) => { if (!cancelled) setRelated(result.relatedProducts || []) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [id])

  const images = product ? productImages(product) : []
  const mine = Boolean(user && product && (product.sellerId === user.id || product.seller?.id === user.id))

  async function startChat() {
    if (!user || !product) {
      navigate('/login')
      return
    }
    setPending(true)
    setError('')
    try {
      const chatId = await openProductChat({
        product,
        buyerId: user.id,
        buyerName: user.fullName || 'Student',
      })
      navigate(`/chats/${encodeURIComponent(chatId)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat')
    } finally {
      setPending(false)
    }
  }

  async function report() {
    if (!reason) {
      setError('Please select a reason for reporting')
      return
    }
    setError('')
    try {
      await api(`/product/products/${id}/report`, {
        method: 'POST',
        body: { reasonCode: reason, ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}) },
      })
      setReportOpen(false)
      setReported(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the report')
    }
  }

  if (!product) {
    return <AppShell><div className="center-state">{error || 'Loading listing…'}</div></AppShell>
  }

  return (
    <AppShell>
      <main className="page">
        <div className="stack">
          {error ? <div className="error">{error}</div> : null}
          <div className="listing-layout">
            <div>
              <div className="gallery">
                {images[photo] ? (
                  <button type="button" className="gallery-open" onClick={() => setViewerOpen(true)} aria-label="View full size photo">
                    <img src={images[photo]} alt="" />
                    <span className="gallery-hint">View full size</span>
                  </button>
                ) : <img src={PLACEHOLDER_IMAGE} alt="" style={{ padding: 48 }} />}
                {images.length > 1 ? (
                  <>
                    <button type="button" className="viewer-btn gallery-prev" aria-label="Previous photo" onClick={() => setPhoto((photo - 1 + images.length) % images.length)}>‹</button>
                    <button type="button" className="viewer-btn gallery-next" aria-label="Next photo" onClick={() => setPhoto((photo + 1) % images.length)}>›</button>
                  </>
                ) : null}
              </div>
              <div className="thumbs">
                {images.map((src, index) => (
                  <button key={src} type="button" className={index === photo ? 'on' : undefined} aria-label={`Photo ${index + 1}`} onClick={() => setPhoto(index)}><img src={src} alt="" /></button>
                ))}
              </div>
              {viewerOpen && images.length > 0 ? (
                <ImageViewer images={images} index={photo} onIndex={setPhoto} onClose={() => setViewerOpen(false)} />
              ) : null}
            </div>
            <div className="stack">
              <div>
                <h1 style={{ margin: '0 0 8px' }}>{productTitle(product)}</h1>
                <div className="price" style={{ fontSize: 28 }}>{formatPrice(product.price)}</div>
                <p className="muted">{placeLabel(product)} · {timeAgo(product.createdAt)} · {product.condition}</p>
              </div>
              <p>{product.description}</p>
              <div className="panel">
                <div className="row">
                  <span className="avatar">{product.seller?.selfieUrl ? <img src={product.seller.selfieUrl} alt="" /> : (product.seller?.fullName || 'S').slice(0, 1)}</span>
                  <div className="grow">
                    <strong>{product.seller?.fullName || 'Seller'}</strong>
                    <div className="muted">{[product.brand, product.usage, product.yearOfPurchase ? `Bought ${product.yearOfPurchase}` : ''].filter(Boolean).join(' · ')}</div>
                  </div>
                  {product.seller?.id ? <Link to={`/u/${product.seller.id}`}>Profile</Link> : null}
                </div>
              </div>
              {mine ? (
                <Link className="btn btn-dark" to={`/my-listings/${product.id}`}>Manage listing</Link>
              ) : (
                <button className="btn btn-dark" type="button" disabled={pending || product.status === 'Sold'} onClick={() => void startChat()}>{product.status === 'Sold' ? 'Sold' : 'Chat with seller'}</button>
              )}
              {reported ? <div className="success">Thanks, our team will review this listing.</div> : null}
              {!mine && !reported ? <button className="btn btn-ghost" type="button" onClick={() => setReportOpen(true)}>Report listing</button> : null}
              {reportOpen ? (
                <div className="panel">
                  <label className="lbl">Reason
                    <select className="field" value={reason} onChange={(event) => setReason(event.target.value)}>
                      <option value="">Select a reason</option>
                      {REPORT_REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </label>
                  <textarea className="field" value={reasonText} onChange={(event) => setReasonText(event.target.value)} placeholder="Add details (optional)" />
                  <button className="btn btn-dark" type="button" onClick={() => void report()}>Submit report</button>
                </div>
              ) : null}
            </div>
          </div>
          <section>
            <h2>Related</h2>
            <div className="grid-4">{related.filter((item) => item.id !== product.id).map((item) => <ProductCard key={item.id} product={item} />)}</div>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
