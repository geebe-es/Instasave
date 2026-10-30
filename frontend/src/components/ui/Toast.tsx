import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { IconAlert, IconCheck, IconInfo, IconX } from '../Icons'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastOptions = {
  kind: ToastKind
  title: string
  message?: string
  action?: ToastAction
  duration?: number
}

type ToastRecord = ToastOptions & { id: string }

const ToastContext = createContext<((toast: ToastOptions) => string) | null>(null)

function ToastCard({ toast, onClose }: { toast: ToastRecord; onClose: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const exitTimerRef = useRef<number | null>(null)

  const close = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    exitTimerRef.current = window.setTimeout(() => onClose(toast.id), 190)
  }, [onClose, toast.id])

  useEffect(() => {
    const timer = window.setTimeout(close, toast.duration ?? 5200)
    return () => window.clearTimeout(timer)
  }, [close, toast.duration])

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
  }, [])

  const Icon = toast.kind === 'success'
    ? IconCheck
    : toast.kind === 'error'
      ? IconAlert
      : toast.kind === 'warning'
        ? IconAlert
        : IconInfo

  return (
    <div
      className={`toast toast--${toast.kind} ${leaving ? 'is-leaving' : ''}`.trim()}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="toast__icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="toast__content">
        <strong>{toast.title}</strong>
        {toast.message ? <p>{toast.message}</p> : null}
        {toast.action ? (
          <button
            type="button"
            className="toast__action"
            onClick={() => {
              toast.action?.onClick()
              close()
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className="toast__close" onClick={close} aria-label="Fechar notificação">
        <IconX size={15} />
      </button>
      <span className="toast__timer" aria-hidden="true" style={{ animationDuration: `${toast.duration ?? 5200}ms` }} />
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(0)

  const remove = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const push = useCallback((toast: ToastOptions) => {
    nextId.current += 1
    const id = `toast-${nextId.current}`
    setToasts(current => [...current.slice(-3), { ...toast, id }])
    return id
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-viewport" aria-label="Notificações">
        {toasts.map(toast => <ToastCard key={toast.id} toast={toast} onClose={remove} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast precisa estar dentro de ToastProvider')
  return push
}
