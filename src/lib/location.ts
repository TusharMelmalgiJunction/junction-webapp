export type SavedLocation = {
  label: string
  lat: number
  lng: number
}

const KEY = 'junction.location'
const DEFAULT_LOCATION: SavedLocation = {
  label: 'Kalyani Nagar, Pune',
  lat: 18.5481,
  lng: 73.9033,
}

let current = load()
const listeners = new Set<() => void>()

function load(): SavedLocation {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_LOCATION
    const parsed = JSON.parse(raw) as SavedLocation
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return DEFAULT_LOCATION
    return parsed
  } catch {
    return DEFAULT_LOCATION
  }
}

export function getLocation() {
  return current
}

export function setLocation(next: SavedLocation) {
  current = next
  localStorage.setItem(KEY, JSON.stringify(next))
  listeners.forEach((listener) => listener())
}

export function subscribeLocation(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function detectBrowserLocation() {
  if (!navigator.geolocation) return
  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          label: 'Current location',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        resolve()
      },
      () => resolve(),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  })
}
