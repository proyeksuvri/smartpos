import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// --- Tambahkan 2 baris kode ini ---
import { testSupabaseConnection } from './lib/testConnection'
testSupabaseConnection()
// ----------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)