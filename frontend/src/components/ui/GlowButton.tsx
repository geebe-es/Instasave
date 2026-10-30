import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

type GlowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  trailing?: ReactNode
  loading?: boolean
  loadingText?: string
  block?: boolean
}

export function GlowButton({
  variant = 'secondary',
  size = 'md',
  icon,
  trailing,
  loading = false,
  loadingText,
  block = false,
  className = '',
  children,
  disabled,
  ...props
}: GlowButtonProps) {
  return (
    <button
      type="button"
      className={`glow-button glow-button--${variant} glow-button--${size} ${block ? 'glow-button--block' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="glow-button__content">
        {loading ? <LoadingSpinner size="sm" label={loadingText ?? 'Processando'} /> : icon ? <span className="glow-button__icon">{icon}</span> : null}
        <span className="glow-button__label">{loading ? loadingText ?? children : children}</span>
        {!loading && trailing ? <span className="glow-button__trailing">{trailing}</span> : null}
      </span>
      {variant === 'primary' ? <span className="glow-button__shine" aria-hidden="true" /> : null}
    </button>
  )
}
