import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initTheme } from './theme.ts'
import {BrowserRouter} from "react-router";

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <BrowserRouter>
            <App />
      </BrowserRouter>
  </StrictMode>,
)
