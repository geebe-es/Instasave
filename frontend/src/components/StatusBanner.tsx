import { IconAlert, IconCheck, IconInfo } from './Icons'
import { LoadingSpinner } from './ui/LoadingSpinner'
import type { Status } from '../types'

export function StatusBanner({ status }: { status: Status }) {
  if (!status) return null
  const Icon = status.type === 'error' ? IconAlert : status.type === 'success' ? IconCheck : IconInfo
  return (
    <div className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'} aria-live="polite">
      <span className="status__icon" aria-hidden="true">
        {status.type === 'loading' ? <LoadingSpinner size="sm" label="Processando" /> : <Icon size={16} />}
      </span>
      <span>{status.message}</span>
    </div>
  )
}
