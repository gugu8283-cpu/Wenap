import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import App from './App.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function AppShell() {
  const { user, loading } = useAuth()
  const [ready, setReady] = useState(false)

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#080b14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}
      >
        …
      </div>
    )
  }

  // Skip splash for guests — go straight to login redirect via ProtectedRoute
  if (!user) {
    return (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    )
  }

  if (!ready) {
    return <SplashScreen onComplete={() => setReady(true)} />
  }

  return (
    <ProtectedRoute>
      <App />
    </ProtectedRoute>
  )
}
