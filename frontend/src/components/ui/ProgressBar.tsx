type ProgressState = 'preparing' | 'downloading' | 'processing' | 'completed' | 'error'

type ProgressBarProps = {
  percent: number | null
  state?: ProgressState
  label?: string
  compact?: boolean
}

export function ProgressBar({ percent, state = 'downloading', label, compact = false }: ProgressBarProps) {
  const determinate = typeof percent === 'number' && Number.isFinite(percent)
  const safePercent = determinate ? Math.max(0, Math.min(100, percent)) : 0
  const visiblePercent = state === 'completed' ? 100 : state === 'error' ? safePercent : safePercent
  const valueText = determinate ? `${Math.round(visiblePercent)}%` : 'Progresso indeterminado'
  return (
    <div
      className={`progress-bar progress-bar--${state} ${compact ? 'progress-bar--compact' : ''} ${determinate ? '' : 'progress-bar--indeterminate'}`.trim()}
      role="progressbar"
      aria-label={label ?? 'Progresso do download'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? Math.round(visiblePercent) : undefined}
      aria-valuetext={valueText}
    >
      <span className="progress-bar__fill" style={{ transform: `scaleX(${determinate ? visiblePercent / 100 : 0.32})` }} />
    </div>
  )
}
