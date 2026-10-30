import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline app shell. Production only; the worker never touches /api.
// Trusted Types is enforced by the page CSP, so the script URL goes through a policy.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const policy = window.trustedTypes?.createPolicy('worktime', {
    createScriptURL: (url) => {
      if (url !== '/sw.js') throw new TypeError('Unexpected script URL')
      return url
    },
  })
  window.addEventListener('load', () => {
    const url = policy ? policy.createScriptURL('/sw.js') : '/sw.js'
    navigator.serviceWorker.register(url as string).catch(() => {
      /* offline support is optional */
    })
  })
}
