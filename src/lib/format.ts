import type { Product } from '../api/types'

export const CATEGORIES: { label: string; value: string; subs: string[] }[] = [
  {
    label: 'Electronics',
    value: 'Electronics',
    subs: ['Mobiles & Tablets', 'Laptops & Computers', 'Audio Devices', 'Wearables', 'Gaming & Consoles', 'Cameras & Photography', 'PC Parts', 'Tech Accessories', 'Home Appliances'],
  },
  {
    label: 'Furniture',
    value: 'Furniture',
    subs: ['Study Furniture', 'Bedroom Furniture', 'Storage & Shelves', 'Room Décor', 'Cleaning Supplies'],
  },
  {
    label: 'Books',
    value: 'Books',
    subs: ['Academic Textbooks', 'Entrance/Exam Prep', 'Novels & Fiction', 'Non-Fiction / Self-help', 'Notes & Lab Manuals', 'Stationery'],
  },
  {
    label: 'Sports',
    value: 'Sports',
    subs: ['Indoor Sports Gear', 'Outdoor Sports Gear', 'Gym & Fitness Equipment', 'Cycling Gear & Accessories', 'Trekking & Travel Gear'],
  },
  {
    label: 'Fashion',
    value: 'Fashion',
    subs: ["Men's Clothing", "Women's Clothing", 'Unisex Clothing', 'Footwear', 'Bags & Backpacks', 'Accessories', 'Luxury Items'],
  },
  {
    label: 'Hobbies',
    value: 'Hobbies',
    subs: ['Musical Instruments', 'Art & Craft Supplies', 'Board Games & Cards', 'Collectibles & Posters', 'Novelty Items'],
  },
  {
    label: 'Vehicles',
    value: 'Vehicles',
    subs: ['Bicycles / E-Cycles', 'Two-Wheelers (Scooters & Motorcycles)', 'Four-Wheelers (Cars & Jeeps)', 'Skateboards & Longboards', 'Roller Skates / Inline Skates', 'Transport Accessories'],
  },
  {
    label: 'Other',
    value: 'Other',
    subs: ['Daily Essentials', 'General Utilities', 'Home Tools', 'Miscellaneous'],
  },
]

export function categoryIcon(category: string) {
  return `/assets/categories/${encodeURIComponent(category)}.png`
}

export const PLACEHOLDER_IMAGE = '/assets/placeholder.png'

export const CONDITIONS = ['Like New', 'Gently Used', 'Fair', 'Needs Fixing']
export const USAGES = ['Normal Usage', 'Heavy Usage', 'Like New']

const TINTS = ['#E4EEF6', '#F3EEE4', '#EFEDFB', '#E6F2EA', '#FCEBDD']

export function productImages(product: Product): string[] {
  const images = product.images
  if (!images) return []
  const list = Array.isArray(images) ? images : [images]
  return list
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const record = item as { url?: string; fileUrl?: string }
        return record.url || record.fileUrl || ''
      }
      return ''
    })
    .filter(Boolean)
}

export function productTitle(product: Product) {
  return product.title || product.name || 'Listing'
}

export function formatPrice(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return 'Price on request'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

export function timeAgo(value?: string) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, (Date.now() - then) / 1000)
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 172800) return 'Yesterday'
  return `${Math.floor(seconds / 86400)} days ago`
}

export function initials(name?: string | null) {
  const parts = (name || 'S').trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'S'
}

export function tintFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash + char.charCodeAt(0)) % TINTS.length
  return TINTS[hash]
}

export function placeLabel(product: Product) {
  if (product.readableLocation) return product.readableLocation
  if (product.distance != null) return `${product.distance.toFixed(1)} km`
  return 'Nearby'
}

export function asProductList(payload: unknown): Product[] {
  if (Array.isArray(payload)) return payload as Product[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { products?: Product[] }).products)) {
    return (payload as { products: Product[] }).products
  }
  return []
}
