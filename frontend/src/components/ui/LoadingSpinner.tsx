type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function LoadingSpinner({ size = 'md', label = 'Carregando', className = '' }: LoadingSpinnerProps) {
  return (
    <span className={`loading-spinner loading-spinner--${size} ${className}`.trim()} role="status" aria-label={label}>
      <span aria-hidden="true" />
    </span>
  )
}
