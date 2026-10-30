import { useSyncExternalStore } from 'react'

const motionQuery = '(prefers-reduced-motion: reduce)'
const mediaQuery = typeof window === 'undefined' ? null : window.matchMedia(motionQuery)
const reducedByPreference = () => Boolean(mediaQuery?.matches)

function subscribePreference(callback: () => void) {
  mediaQuery?.addEventListener('change', callback)
  return () => mediaQuery?.removeEventListener('change', callback)
}

function subscribeCombined(callback: () => void) {
  const unsubscribe = subscribePreference(callback)
  const observer = typeof MutationObserver === 'undefined'
    ? null
    : new MutationObserver(callback)
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    unsubscribe()
    observer?.disconnect()
  }
}

function combinedSnapshot() {
  return reducedByPreference() || document.documentElement.dataset.motion === 'reduced'
}

export function useSystemReducedMotion() {
  return useSyncExternalStore(subscribePreference, reducedByPreference, () => false)
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeCombined, combinedSnapshot, () => false)
}
