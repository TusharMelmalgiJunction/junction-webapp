import { useEffect, useSyncExternalStore } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { getFavouriteIds, loadFavourites, subscribeFavourites, toggleFavourite } from '../lib/favourites'
import { PLACEHOLDER_IMAGE, formatPrice, initials, placeLabel, productImages, productTitle, timeAgo, tintFor } from '../lib/format'
import { Icon, icons } from './Icon'

export function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth()
  const saved = useSyncExternalStore(subscribeFavourites, getFavouriteIds, getFavouriteIds)
  const favourite = saved.has(product.id)
  const image = productImages(product)[0]
  const title = productTitle(product)
  const mine = Boolean(user && (product.sellerId === user.id || product.seller?.id === user.id))

  useEffect(() => {
    if (user?.isOnboarded) void loadFavourites()
  }, [user?.isOnboarded])

  function onHeart(event: MouseEvent) {
    event.preventDefault()
    if (!user) return
    void toggleFavourite(product).catch(() => undefined)
  }

  return (
    <Link to={`/listing/${product.id}`} className="product-card">
      <div className="product-photo" style={{ background: tintFor(product.id) }}>
        <img src={image || PLACEHOLDER_IMAGE} alt="" style={image ? undefined : { objectFit: 'contain', padding: 24 }} />
        {user && !mine ? (
          <button className={favourite ? 'heart on' : 'heart'} type="button" aria-label={favourite ? 'Remove from favourites' : 'Save listing'} aria-pressed={favourite} onClick={onHeart}>
            <Icon paths={icons.heart} />
          </button>
        ) : null}
      </div>
      <h3>{title}</h3>
      <div className="price">{formatPrice(product.price)}</div>
      <div className="meta">
        <span>{placeLabel(product)}</span>
        <span>{timeAgo(product.createdAt)}</span>
      </div>
      {product.seller?.fullName ? <span className="muted">{initials(product.seller.fullName)} · {product.seller.fullName}</span> : null}
    </Link>
  )
}
