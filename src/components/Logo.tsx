import { Link } from 'react-router-dom'

const TILES = ['logo-a', 'logo-b', 'logo-c', 'logo-d']

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <Link to="/" className="logo" aria-label="Junction home">
      <span className="logo-mark" style={large ? { transform: 'scale(1.15)' } : undefined}>
        {TILES.map((tile) => <img key={tile} src={`/assets/${tile}.png`} alt="" />)}
      </span>
      <span>junction</span>
    </Link>
  )
}
