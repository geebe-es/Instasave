import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ToastProvider } from './components/ui/Toast'
import './styles/tokens.css'
import './styles.css'
import './styles/animations.css'
import './styles/effects.css'
import './workspace.css'
import './desktop.css'

try {
  if (localStorage.getItem('instasave:reduce-motion') === 'true') {
    document.documentElement.dataset.motion = 'reduced'
  }
} catch {
  /* preferência local opcional */
}

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
)
