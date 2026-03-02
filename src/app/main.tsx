import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../styles/index.css'

if (import.meta.env.DEV && window.__E2E__?.enabled) {
  void import('../dev/e2eMediaMocks').then(({ setupE2EMediaMocks }) => {
    setupE2EMediaMocks();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
