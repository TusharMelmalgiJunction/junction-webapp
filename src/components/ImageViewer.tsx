import { useEffect, useState } from 'react'

// Full-screen photo viewer, the web counterpart of the app's _FullScreenImageViewer:
// swipe/arrow between photos, click to zoom to full resolution, Esc to close.
export function ImageViewer({ images, index, onIndex, onClose }: {
  images: string[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const [zoomed, setZoomed] = useState(false)
  const [touchX, setTouchX] = useState<number | null>(null)
  const count = images.length

  const go = (step: number) => {
    setZoomed(false)
    onIndex((index + step + count) % count)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight' && count > 1) go(1)
      else if (event.key === 'ArrowLeft' && count > 1) go(-1)
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  })

  return (
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Listing photos"
      onClick={onClose}
      onTouchStart={(event) => setTouchX(event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touchX === null || zoomed || count < 2) return
        const delta = event.changedTouches[0].clientX - touchX
        if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1)
        setTouchX(null)
      }}
    >
      <div className="viewer-bar" onClick={(event) => event.stopPropagation()}>
        <span>{count > 1 ? `${index + 1} / ${count}` : ''}</span>
        <button type="button" className="viewer-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className={zoomed ? 'viewer-stage zoomed' : 'viewer-stage'}>
        <img
          src={images[index]}
          alt={`Photo ${index + 1} of ${count}`}
          onClick={(event) => {
            event.stopPropagation()
            setZoomed((value) => !value)
          }}
        />
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="viewer-btn viewer-prev" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); go(-1) }}>‹</button>
          <button type="button" className="viewer-btn viewer-next" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); go(1) }}>›</button>
        </>
      ) : null}
    </div>
  )
}
