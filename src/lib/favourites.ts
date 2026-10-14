import { api } from '../api/client'
import type { Product } from '../api/types'

// Saved listings for the signed-in user, shared by every ProductCard so hearts
// reflect what's already saved (GET /user/my-favourites, same as the app).
let products: Product[] = []
let ids = new Set<string>()
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setProducts(next: Product[]) {
  products = next
  ids = new Set(next.map((product) => product.id))
  emit()
}

export function subscribeFavourites(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getFavouriteIds() {
  return ids
}

export function getFavouriteProducts() {
  return products
}

export function loadFavourites(force = false) {
  if (loading && !force) return loading
  loading = api<{ favourites?: Product[] }>('/user/my-favourites')
    .then((result) => setProducts(result.favourites || []))
    .catch(() => undefined)
  return loading
}

export async function toggleFavourite(product: Product) {
  const saved = ids.has(product.id)
  const previous = products
  setProducts(saved ? products.filter((item) => item.id !== product.id) : [product, ...products])
  try {
    await api(saved ? '/user/remove-favourite' : '/user/add-favourite', {
      method: 'POST',
      body: { productId: product.id },
    })
  } catch (err) {
    setProducts(previous)
    throw err
  }
}

export function resetFavourites() {
  loading = null
  setProducts([])
}
