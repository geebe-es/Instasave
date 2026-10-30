import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type MotionCardProps = HTMLAttributes<HTMLElement> & {
  index?: number
  children: ReactNode
}

export function MotionCard({ index = 0, className = '', style, children, ...props }: MotionCardProps) {
  return (
    <article
      className={`motion-card ${className}`.trim()}
      style={{ ...style, '--i': index } as CSSProperties}
      {...props}
    >
      {children}
    </article>
  )
}
