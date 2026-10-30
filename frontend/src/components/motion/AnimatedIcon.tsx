import type { ReactNode } from 'react'

type AnimatedIconProps = {
  children: ReactNode
  variant?: 'download' | 'history' | 'settings' | 'refresh' | 'check' | 'sparkle' | 'soft'
  active?: boolean
  className?: string
}

export function AnimatedIcon({ children, variant = 'soft', active = false, className = '' }: AnimatedIconProps) {
  return (
    <span className={`animated-icon animated-icon--${variant} ${active ? 'is-active' : ''} ${className}`.trim()}>
      {children}
    </span>
  )
}
