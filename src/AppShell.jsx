import { useState } from 'react'
import App from './App.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function AppShell() {
  const [ready, setReady] = useState(false)

  if (!ready) {
    return <SplashScreen onComplete={() => setReady(true)} />
  }

  return (
    <ProtectedRoute>
      <App />
    </ProtectedRoute>
  )
}
