import { useEffect, useState, type CSSProperties } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const PARTICLES = [
  { left: '7%', top: '64%', size: 3, delay: '-3s', duration: '19s', opacity: 0.34 },
  { left: '13%', top: '24%', size: 2, delay: '-12s', duration: '23s', opacity: 0.28 },
  { left: '22%', top: '76%', size: 2, delay: '-7s', duration: '21s', opacity: 0.24 },
  { left: '34%', top: '18%', size: 3, delay: '-15s', duration: '26s', opacity: 0.22 },
  { left: '46%', top: '68%', size: 2, delay: '-5s', duration: '18s', opacity: 0.3 },
  { left: '58%', top: '31%', size: 2, delay: '-17s', duration: '24s', opacity: 0.2 },
  { left: '67%', top: '79%', size: 3, delay: '-9s', duration: '22s', opacity: 0.26 },
  { left: '78%', top: '21%', size: 2, delay: '-2s', duration: '20s', opacity: 0.32 },
  { left: '88%', top: '58%', size: 2, delay: '-13s', duration: '25s', opacity: 0.22 },
  { left: '94%', top: '36%', size: 3, delay: '-6s', duration: '17s', opacity: 0.28 },
]

export function AnimatedBackground() {
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const handleVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <div className={`background-scene ${paused ? 'is-paused' : ''} ${reduced ? 'is-reduced' : ''}`.trim()} aria-hidden="true">
      <div className="background-scene__wash" />
      <div className="background-scene__aurora background-scene__aurora--violet" />
      <div className="background-scene__aurora background-scene__aurora--pink" />
      <div className="background-scene__wave background-scene__wave--one" />
      <div className="background-scene__wave background-scene__wave--two" />
      <div className="background-scene__wave-line background-scene__wave-line--one" />
      <div className="background-scene__wave-line background-scene__wave-line--two" />
      <div className="background-scene__grid" />
      <div className="background-scene__particles">
        {!reduced && PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="background-scene__particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="background-scene__vignette" />
    </div>
  )
}
