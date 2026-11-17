import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Application render failed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert" style={{ maxWidth: 640, margin: '12vh auto', padding: 24, color: '#00338d', fontFamily: 'Arial, sans-serif' }}>
          <h1>GenAI Playground could not load</h1>
          <p>Refresh the page to try again. If the problem continues, share the error details below with support.</p>
          <details>
            <summary>Error details</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          </details>
          <button type="button" onClick={() => window.location.reload()}>Refresh page</button>
        </main>
      )
    }

    return this.props.children
  }
}

// Entra/MSAL is intentionally NOT initialized here.
// Authentication belongs only to the Admin route so a missing/misconfigured
// Admin registration can never block Business Journey, Use-Cases or other tabs.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
