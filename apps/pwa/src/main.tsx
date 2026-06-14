import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { DrillProvider } from './lib/drill'
import { initSync } from './lib/sync.ts'

// Initialize background sync + heartbeats
initSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DrillProvider>
          <App />
        </DrillProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
