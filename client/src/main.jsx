import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV) {
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return
    const path = window.location.pathname
    if (path === '/login' || path === '/register' || path === '/auth/callback') {
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
