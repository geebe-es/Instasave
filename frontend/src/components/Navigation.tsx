import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { IconDownload, IconHistory, IconRefresh, IconSettings, IconVideo } from './Icons'
import { AnimatedIcon } from './motion/AnimatedIcon'
import type { Page } from '../types'

const ITEMS = [
  { id: 'download' as const, label: 'Imagens', icon: IconDownload, variant: 'download' as const },
  { id: 'videos' as const, label: 'Vídeos', icon: IconVideo, variant: 'download' as const },
  { id: 'history' as const, label: 'Histórico', icon: IconHistory, variant: 'history' as const },
  { id: 'settings' as const, label: 'Configurações', icon: IconSettings, variant: 'settings' as const },
  { id: 'updates' as const, label: 'Atualizações', icon: IconRefresh, variant: 'refresh' as const },
]

type NavigationProps = {
  page: Page
  onChange: (page: Page) => void
}

export function Navigation({ page, onChange }: NavigationProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  const measure = useCallback(() => {
    const activeIndex = ITEMS.findIndex(item => item.id === page)
    const active = itemRefs.current[activeIndex]
    if (!active) return
    setIndicator(current => (
      current.left === active.offsetLeft && current.width === active.offsetWidth && current.ready
        ? current
        : { left: active.offsetLeft, width: active.offsetWidth, ready: true }
    ))
  }, [page])

  useLayoutEffect(() => { measure() }, [measure])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure).catch(() => undefined)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  return (
    <nav className="app-nav" aria-label="Navegação principal">
      <div className="nav-items" ref={listRef}>
        <span
          className={`nav-indicator ${indicator.ready ? 'is-ready' : ''}`.trim()}
          style={{
            transform: `translate3d(${indicator.left}px, 0, 0)`,
            width: indicator.width,
          } as CSSProperties}
          aria-hidden="true"
        />
        {ITEMS.map((item, index) => {
          const Icon = item.icon
          const active = item.id === page
          return (
            <button
              key={item.id}
              ref={element => { itemRefs.current[index] = element }}
              type="button"
              className={`nav-item ${active ? 'is-active' : ''}`.trim()}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(item.id)}
            >
              <AnimatedIcon variant={item.variant} active={active}><Icon size={17} /></AnimatedIcon>
              <span className="nav-item__label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
