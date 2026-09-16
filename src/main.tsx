import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', sans-serif; background: #f8fafc; }
  button { font-family: inherit; cursor: pointer; }
  a { font-family: inherit; }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
