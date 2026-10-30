import type { HTMLAttributes, ReactNode } from 'react'

type GlassPanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  glow?: boolean
  elevated?: boolean
}

export function GlassPanel({ children, className = '', glow = false, elevated = false, ...props }: GlassPanelProps) {
  return (
    <section
      className={`glass-panel ${glow ? 'glass-panel--glow' : ''} ${elevated ? 'glass-panel--elevated' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  )
}
