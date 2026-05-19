import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const location = useLocation()

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
        {t('protected.loading')}
      </div>
    )
  }

  if (!user) {
    // If user visits /app directly while unauthenticated, send to landing
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (!user.emailVerified) {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email || '')}`} replace />
  }

  return children
}
